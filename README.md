# express-okta-cerbos

An example stack of integrating [Cerbos](https://cerbos.dev) with an [Express](https://expressjs.com/) server using [Okta](https://okta.com) for authentication and user management.

## Dependencies

- Okta account
- Node

> For simplicity this demo is using the hosted Cerbos Demo PDP avaliable in the Playground so running the Cerbos container locally isn't required. For production use cases a deployed Cerbos PDP is required and the code updated to point to your instance. You can read more about the deployment options [here](https://docs.cerbos.dev/cerbos/latest/deployment/index.html).


## Setup

### Install Deps

Clone this repoo and run `npm install`

### Create an Okta Application

In your Okta instance you need to create a new application. For this example we will be making use of Okta's ExpressOIDC package so the application's sign-in method needs to be `OIDC - OpenID Connect` and the application type is `Web Application`.

<img src="docs/okta-create-app.png" />

### Set Redirect URLs

The default redirect URLs for sign-in and sign-out are correct if you are running this demo app on the default 8080 port. If you have chanaged this in your `.env` file then you will need to update accordingly.

<img src="docs/okta-app-settings.png" />

### Enabling Groups in the Okta Token

By default the groups the user belongs to are not passed to the application in the Okta token - this needs enabling as these groups will be passed from Okta to Cerbos for use in authorization decisions.

To do this, goto _Security > API_ in the sidebar, and edit the default _Authorization Server_.

On this page, got the _Claims_ tab and press _Add Claim_. Add a new claim called groups which includes the groups of the user in the ID token.

<img src="docs/okta-groups-claim.png">

> In production you will likely want to filter this down, but for this example we are enabling all groups to be added to the token.

### Create an example `admin` group.

In a new Okta account the only group that exists is the _Everyone_ group. For our demo application policies we expect users to be in `admin` or `user` group as this is what is checked.

Under _Directory > Groups_ press _Add Group_ and create the two groups and add your example users to them.


### Setup Environment Variables

Make a copy of the `.env.sample` file and call it `.env`. You will then need to populate the feilds that begin with `OKTA_` with the information provided in the new application you created.

```
PORT=8080
CERBOS_HOSTNAME=https://demo-pdp.cerbos.cloud
CERBOS_PLAYGROUND=ygW612cc9c9xXOsOZjI40ovY2LZvXf43
OKTA_DOMAIN=
OKTA_CLIENTID=
OKTA_CLIENTSECRET=
OKTA_APP_BASE_URL=http://localhost:8080
```

>This example is using the hosted Demo PDP of Cerbos and an example Playground instance. If you are running your own Cerbos PDP then update the `CERBOS_HOSTNAME` feild to your own instance and remove the `CERBOS_PLAYGROUND` feild.

### Test the app

Now that everything is wired up you should be able to goto [`http://localhost:8080`](http://localhost:8080) and press the login link to authenticate with your FusionAuth account.

## Policies

This example has a simple CRUD policy in place for a resource kind of `contact` - like a CRM system would have. Should you wish to experiment with this policy, you can <a href="https://play.cerbos.dev/p/sZC611cf06deexP0q8CTcVufTVau1SA3" target="_blank">try it in the Cerbos Playground</a>.

<a href="https://play.cerbos.dev/p/sZC611cf06deexP0q8CTcVufTVau1SA3" target="_blank"><img src="docs/launch.jpg" height="48" /></a>

The policy expects one of two roles to be set on the principal - `admin` and `user`. These roles are authorized as follows:

| Action | User     | Admin |
| ------ | -------- | ----- |
| list   | Y        | Y     |
| read   | Y        | Y     |
| create | Y        | Y     |
| update | If owner | Y     |
| delete | If owner | Y     |


## Request Flow

1. User access the application and clicks `Login`
2. User is directed to the Okta UI and authenticates
3. A token is returned back in the redirect URL to the application
4. That token is then exchanged for the user profile information
5. The user profile from Okta being stored (user Id, roles etc).
6. Any requests to the `/contacts` endpoints fetch the data required about the resource being accessed from the data store
7. Call the Cerbos PDP with the principal, resource and action to check the authorization and then return an error if the user is not authorized. The [Cerbos package](https://www.npmjs.com/package/cerbos) is used for this.

```js
const allowed = await cerbos.check({
  principal: { //pass in the Okta user ID and groups
    id: req.userContext.userinfo.sub,
    roles: req.userContext.userinfo.groups,
  },
  resource: {
    kind: "contact",
    instances: {
      //a map of the resource(s) being accessed
      [contact.id]: {
        attr: contact,
      },
    },
  },
  actions: ["read"], //the list of actions being performed
});

// not authorized for read action
if (!allowed.isAuthorized(contact.id, "read")) {
  return res.status(403).json({ error: "Unauthorized" });
}
```
Implementation at this stage will be dependant on your business requirements.

## Resources
* [Try online with the Cerbos playground](https://play.cerbos.dev)
* [Explore demo repositories](https://github.com/cerbos)
* [Read the documentation](https://docs.cerbos.dev)
* [Subscribe to our newsletter](https://cerbos.dev/subscribe)
* [Join the community on Slack](http://go.cerbos.io/slack)