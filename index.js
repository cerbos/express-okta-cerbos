import path from "path";
import dotenv from "dotenv";
import express from "express";
import { Cerbos } from "cerbos";
import session from "express-session";

import OKTA from "@okta/oidc-middleware";
import db from "./db.js";

dotenv.config();
const { ExpressOIDC } = OKTA;

console.log(process.env.CERBOS_PLAYGROUND);
const cerbos = new Cerbos({
  hostname: process.env.CERBOS_HOSTNAME, // The Cerbos PDP instance
  playgroundInstance: process.env.CERBOS_PLAYGROUND, // The playground instance ID to test
  logLevel: "debug", // The level of logging to use
});

const app = express();

const oidc = new ExpressOIDC({
  issuer: `https://${process.env.OKTA_DOMAIN}/oauth2/default`,
  client_id: process.env.OKTA_CLIENTID,
  client_secret: process.env.OKTA_CLIENTSECRET,
  appBaseUrl: process.env.OKTA_APP_BASE_URL,
  scope: "openid profile",
});

// const __dirname = path.resolve();
// app.set("views", path.join(__dirname, "views"));
// app.set("view engine", "pug");

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
// app.use(express.static(path.join(__dirname, "public")));

app.use(
  session({
    secret: "this-should-be-very-random",
    resave: true,
    saveUninitialized: false,
  })
);
app.use(oidc.router);

app.get("/", (req, res) => {
  if (req.userContext) {
    res.send(`
      Hello ${req.userContext.userinfo.name}!
      <form method="POST" action="/logout">
        <button type="submit">Logout</button>
      </form>
    `);
  } else {
    res.send('Please <a href="/login">login</a>');
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

  // check user is authorized
  const allowed = await cerbos.check({
    principal: {
      id: req.userContext.userinfo.sub,
      roles: req.userContext.userinfo.roles || ["user"],
    },
    resource: {
      kind: "contact",
      instances: {
        [contact.id]: {
          attr: contact,
        },
      },
    },
    actions: ["read"],
  });

  // authorized for read action
  if (allowed.isAuthorized(contact.id, "read")) {
    return res.json(contact);
  } else {
    return res.status(403).json({ error: "Unauthorized" });
  }
});

// CREATE
app.post("/contacts/new", oidc.ensureAuthenticated(), async (req, res) => {
  // check user is authorized
  const allowed = await cerbos.check({
    principal: {
      id: req.userContext.userinfo.sub,
      roles: req.userContext.userinfo.roles || ["user"],
    },
    resource: {
      kind: "contact",
      instances: {
        new: {},
      },
    },
    actions: ["create"],
  });

  // authorized for create action
  if (allowed.isAuthorized("new", "create")) {
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

  const allowed = await cerbos.check({
    principal: {
      id: req.userContext.userinfo.sub,
      roles: req.userContext.userinfo.roles || ["user"],
    },
    resource: {
      kind: "contact",
      instances: {
        [contact.id]: {
          attr: contact,
        },
      },
    },
    actions: ["update"],
  });

  if (allowed.isAuthorized(req.params.id, "update")) {
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

  const allowed = await cerbos.check({
    principal: {
      id: req.userContext.userinfo.sub,
      roles: req.userContext.userinfo.roles || ["user"],
    },
    resource: {
      kind: "contact",
      instances: {
        [contact.id]: {
          attr: contact,
        },
      },
    },
    actions: ["delete"],
  });

  if (allowed.isAuthorized(req.params.id, "delete")) {
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

  // check user is authorized
  const allowed = await cerbos.check({
    principal: {
      id: req.userContext.userinfo.sub,
      roles: req.userContext.userinfo.roles || ["user"],
    },
    resource: {
      kind: "contact",
      instances: contacts.reduce(function (result, item, index, array) {
        result[item.id] = item; //a, b, c
        return result;
      }, {}),
    },
    actions: ["list"],
  });

  // filter only those authorised
  const result = contacts.filter((c) => allowed.isAuthorized(c.id, "list"));

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
