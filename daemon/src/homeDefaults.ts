/**
 * Values that belong to the platform owner's own home machine. They are the
 * defaults of HOME mode only (NODEOS_MODE unset), kept exactly as they were so
 * the existing machine behaves the same.
 *
 * Customer mode never reads this file. The customer image build also replaces
 * the compiled copy with empty strings (see customer/Dockerfile), so none of
 * these values ship to a customer.
 */
export const HOME_DEFAULTS = {
  ownerName: "Matt",
  paperclipCompany: "ffaab782-ce21-4946-b86c-dbab054ddf1c",
  paperclipLead: "19db7bc5-ff7f-4b5c-b2c2-a1f2ad35085b",
  doorPublic: "https://steve-ms-7c02.tail1af4f2.ts.net:10000",
  nodePublic: "https://steve-ms-7c02.tail1af4f2.ts.net:14443",
  uploadDir: "/hdd/home/steve/nodeos/uploads",
};
