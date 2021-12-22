const contacts = [
  {
    id: "contact-1",
    name: "John Smith",
    email: "john@acme.com",
  },
  {
    id: "contact-2",
    name: "Sarah Jane",
    email: "sarah@acme.com",
  },
];

export default {
  findOne: (id) => {
    return contacts.find((c) => c.id === id);
  },
  find: () => {
    return contacts;
  },
};
