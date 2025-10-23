import path from "path";
import dotenv from "dotenv";
import express from "express";
import { HTTP as Cerbos } from "@cerbos/http";
import session from "express-session";

import OKTA from "@okta/oidc-middleware";
import db from "./db.js";

dotenv.config();
const { ExpressOIDC } = OKTA;

const cerbos = new Cerbos(process.env.CERBOS_HOSTNAME, {
  playgroundInstanceId: process.env.CERBOS_PLAYGROUND_INSTANCEID,
});

const app = express();

const buildPrincipal = (userinfo) => ({
  id: userinfo.sub,
  roles: userinfo.groups ?? [],
});

const toContactResource = (contact) => ({
  kind: "contact",
  id: contact.id,
  attr: contact,
});

const oidc = new ExpressOIDC({
  issuer: `https://${process.env.OKTA_DOMAIN}/oauth2/default`,
  client_id: process.env.OKTA_CLIENTID,
  client_secret: process.env.OKTA_CLIENTSECRET,
  appBaseUrl: process.env.OKTA_APP_BASE_URL,
  scope: "openid profile",
});

const __dirname = path.resolve();
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "pug");

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, "public")));

app.use(
  session({
    secret: "this-should-be-very-random",
    resave: true,
    saveUninitialized: false,
  })
);
app.use(oidc.router);

app.get("/", async (req, res) => {
  if (req.userContext) {
    // fetch Cerbos response to display for demo purposes
    const principal = buildPrincipal(req.userContext.userinfo);
    const contacts = db.find(req.params.id);
    const cerbosRequest = contacts.map((contact) => ({
      principal: {
        ...principal,
        roles: [...principal.roles],
      },
      resource: toContactResource(contact),
      actions: ["update", "delete"],
    }));
    // check user is authorized
    const cerbosDecisions = await Promise.all(
      cerbosRequest.map((request) => cerbos.checkResource(request))
    );
    const cerbosResponse = cerbosDecisions.map((decision) => ({
      resource: decision.resource,
      actions: decision.actions,
      allowedActions: decision.allowedActions(),
    }));

    res.render("index-loggedin", {
      title: "Cerbos/Okta Demo",
      subtitle: `Logged in as ${req.userContext.userinfo.name}`,
      user: req.userContext.userinfo,
      cerbosRequest,
      cerbosResponse,
    });
  } else {
    res.render("index-loggedout", {
      title: "Cerbos/Okta Demo",
      subtitle: `Not logged in`,
    });
  }
});

//debug
app.get("/profile", oidc.ensureAuthenticated(), async (req, res) => {
  res.json(req.userContext);
});

// READ
app.get("/contacts/:id", oidc.ensureAuthenticated(), async (req, res) => {
  // load the contact
  const contact = db.findOne(req.params.id);
  if (!contact) {
    return res.status(404).json({ error: "Contact not found" });
  }

  const principal = buildPrincipal(req.userContext.userinfo);
  // check user is authorized
  const decision = await cerbos.checkResource({
    principal,
    resource: toContactResource(contact),
    actions: ["read"],
  });

  // authorized for read action
  if (decision.isAllowed("read")) {
    return res.json(contact);
  } else {
    return res.status(403).json({ error: "Unauthorized" });
  }
});

// CREATE
app.post("/contacts/new", oidc.ensureAuthenticated(), async (req, res) => {
  // check user is authorized
  const principal = buildPrincipal(req.userContext.userinfo);
  const decision = await cerbos.checkResource({
    principal,
    resource: {
      kind: "contact",
      id: "new",
    },
    actions: ["create"],
  });

  // authorized for create action
  if (decision.isAllowed("create")) {
    return res.json({ result: "Created contact" });
  } else {
    return res.status(403).json({ error: "Unauthorized" });
  }
});

// UPDATE
app.patch("/contacts/:id", oidc.ensureAuthenticated(), async (req, res) => {
  const contact = db.findOne(req.params.id);
  if (!contact) {
    return res.status(404).json({ error: "Contact not found" });
  }

  const principal = buildPrincipal(req.userContext.userinfo);
  const decision = await cerbos.checkResource({
    principal,
    resource: toContactResource(contact),
    actions: ["update"],
  });

  if (decision.isAllowed("update")) {
    return res.json({
      result: `Updated contact ${req.params.id}`,
    });
  } else {
    return res.status(403).json({ error: "Unauthorized" });
  }
});

// DELETE
app.delete("/contacts/:id", oidc.ensureAuthenticated(), async (req, res) => {
  const contact = db.findOne(req.params.id);
  if (!contact) {
    return res.status(404).json({ error: "Contact not found" });
  }

  const principal = buildPrincipal(req.userContext.userinfo);
  const decision = await cerbos.checkResource({
    principal,
    resource: toContactResource(contact),
    actions: ["delete"],
  });

  if (decision.isAllowed("delete")) {
    return res.json({
      result: `Contact ${req.params.id} deleted`,
    });
  } else {
    return res.status(403).json({ error: "Unauthorized" });
  }
});

// LIST
app.get("/contacts", oidc.ensureAuthenticated(), async (req, res) => {
  // load the contacts
  const contacts = db.find(req.params.id);
  const principal = buildPrincipal(req.userContext.userinfo);

  // check user is authorized
  const decisions = await Promise.all(
    contacts.map((contact) =>
      cerbos.checkResource({
        principal,
        resource: toContactResource(contact),
        actions: ["list"],
      })
    )
  );

  // filter only those authorised
  const result = contacts.filter((contact, index) =>
    decisions[index].isAllowed("list")
  );

  // return the contact
  return res.json(result);
});

oidc.on("ready", () => {
  app.listen(process.env.PORT, () =>
    console.log(`app started on http://localhost:${process.env.PORT}`)
  );
});

oidc.on("error", (err) => {
  console.error(err);
});
