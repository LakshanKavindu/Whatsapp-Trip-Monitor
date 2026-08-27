const { parseMessage } = require("./shared/parser");
const { findMatches } = require("./shared/matcher");

const filters = [
  { id: "1", label: "Arugambay -> Galle", pickup: "Arugambay", drop: "Galle", vehicle: "", enabled: true },
  { id: "2", label: "Anywhere -> Airport, sedan", pickup: "", drop: "airport", vehicle: "sedan", enabled: true },
  { id: "3", label: "Kandy -> Anywhere", pickup: "kandy", drop: "", vehicle: "", enabled: true },
  { id: "4", label: "disabled test", pickup: "galle", drop: "", vehicle: "", enabled: false },
];

const tests = [
  `⛳️  Pick -  Arugambay \n⚓️Drop - Galle (via Hiriketiye`, // should match filter 1
  `From-ahangama\n TO -airport \nvehicle- sedan`, // should match filter 2
  `PICK UP : Kandy\nDROP : Negombo`, // should match filter 3
  `Pick up - trincomalee\nDrop - arugambay`, // should match nothing
  `Picup galle\nDrop: airport`, // filter 4 disabled shouldn't fire even though galle matches
];

tests.forEach((t, i) => {
  const parsed = parseMessage(t);
  const matches = findMatches(parsed, filters);
  console.log(`Test ${i + 1}: pickup="${parsed.pickup}" drop="${parsed.drop}" -> matched filters: [${matches.map(m => m.label).join(", ") || "none"}]`);
});
