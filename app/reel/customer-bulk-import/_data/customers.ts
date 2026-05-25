// 18 mock customers for the bulk-import demo. Designed to look like a real
// distributor's book — mixed restaurants, grocers, and a couple of caterers.
// Names are intentionally varied so the spreadsheet feels human-typed.

export type DemoCustomer = {
  name: string;
  phone: string;
  email: string;
  abbreviation: string;
  city: string;
  state: string;
  terms: string;
};

export const DEMO_CUSTOMERS: DemoCustomer[] = [
  {
    name: "Lighthouse Cafe",
    phone: "(415) 555-0144",
    email: "orders@lighthousecafe.com",
    abbreviation: "LCH",
    city: "San Francisco",
    state: "CA",
    terms: "Net 15",
  },
  {
    name: "Bramble & Bay Bistro",
    phone: "(415) 555-0192",
    email: "ap@brambleandbay.com",
    abbreviation: "BBB",
    city: "Oakland",
    state: "CA",
    terms: "Net 30",
  },
  {
    name: "Marin Market Co.",
    phone: "(415) 555-0210",
    email: "buying@marinmarket.co",
    abbreviation: "MMC",
    city: "Sausalito",
    state: "CA",
    terms: "Net 7",
  },
  {
    name: "Pacific Pearl Sushi",
    phone: "(650) 555-0177",
    email: "kitchen@pacificpearl.com",
    abbreviation: "PPS",
    city: "Burlingame",
    state: "CA",
    terms: "COD",
  },
  {
    name: "Olive Branch Catering",
    phone: "(408) 555-0153",
    email: "ap@olivebranchsj.com",
    abbreviation: "OBC",
    city: "San Jose",
    state: "CA",
    terms: "Net 30",
  },
  {
    name: "Redwood Grill",
    phone: "(707) 555-0125",
    email: "purchasing@redwoodgrill.com",
    abbreviation: "RWG",
    city: "Petaluma",
    state: "CA",
    terms: "Net 15",
  },
  {
    name: "Sea Salt Smokehouse",
    phone: "(310) 555-0162",
    email: "manager@seasaltsmoke.com",
    abbreviation: "SSS",
    city: "Santa Monica",
    state: "CA",
    terms: "Net 30",
  },
  {
    name: "Highland Provisions",
    phone: "(415) 555-0184",
    email: "office@highlandprov.com",
    abbreviation: "HLP",
    city: "Mill Valley",
    state: "CA",
    terms: "Net 15",
  },
  {
    name: "Copper Pot Kitchen",
    phone: "(415) 555-0199",
    email: "info@copperpotsf.com",
    abbreviation: "CPK",
    city: "San Francisco",
    state: "CA",
    terms: "Net 7",
  },
  {
    name: "Magnolia Diner",
    phone: "(510) 555-0148",
    email: "orders@magnoliadiner.com",
    abbreviation: "MAG",
    city: "Berkeley",
    state: "CA",
    terms: "COD",
  },
  {
    name: "Vine Street Trattoria",
    phone: "(415) 555-0173",
    email: "purchasing@vinestreet.it",
    abbreviation: "VST",
    city: "San Francisco",
    state: "CA",
    terms: "Net 30",
  },
  {
    name: "Tidewater Oyster Bar",
    phone: "(415) 555-0118",
    email: "kitchen@tidewateroyster.com",
    abbreviation: "TOB",
    city: "Alameda",
    state: "CA",
    terms: "Net 15",
  },
  {
    name: "Garden Path Grocer",
    phone: "(650) 555-0188",
    email: "ap@gardenpathmarket.com",
    abbreviation: "GPG",
    city: "Palo Alto",
    state: "CA",
    terms: "Net 30",
  },
  {
    name: "Anchor Tavern",
    phone: "(415) 555-0167",
    email: "office@anchortavern.com",
    abbreviation: "ANC",
    city: "Tiburon",
    state: "CA",
    terms: "Net 7",
  },
  {
    name: "Sunburst Cafe",
    phone: "(925) 555-0136",
    email: "orders@sunburstcafe.com",
    abbreviation: "SBC",
    city: "Walnut Creek",
    state: "CA",
    terms: "COD",
  },
  {
    name: "Foggy Knoll Bakery",
    phone: "(415) 555-0102",
    email: "buying@foggyknoll.com",
    abbreviation: "FKB",
    city: "Daly City",
    state: "CA",
    terms: "Net 15",
  },
  {
    name: "Iron & Oak Steakhouse",
    phone: "(408) 555-0171",
    email: "manager@ironandoak.com",
    abbreviation: "IOS",
    city: "Los Gatos",
    state: "CA",
    terms: "Net 30",
  },
  {
    name: "Ferry Plaza Cafe",
    phone: "(415) 555-0156",
    email: "ops@ferryplazacafe.com",
    abbreviation: "FPC",
    city: "San Francisco",
    state: "CA",
    terms: "Net 15",
  },
];

export const TOTAL_CUSTOMERS = DEMO_CUSTOMERS.length;
