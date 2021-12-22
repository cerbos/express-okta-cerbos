# express-okta-cerbos

An example stack of integrating [Cerbos](https://cerbos.dev) with an [Express](https://expressjs.com/) server using [Okta](https://okta.com) for authentication and user management.

## Dependencies

- Okta account
- Node

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