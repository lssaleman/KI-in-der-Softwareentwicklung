export interface Verein {
  name: string;
  adresse: {
    strasse: string;
    plz: string;
    ort: string;
  };
  vorstand: {
    vorsitzender: string;
    stellvertreter: string;
    kassenwart: string;
  };
  kontakt: {
    telefon: string;
    email: string;
  };
  registergericht: string;
  registernummer: string;
}

export const VEREIN: Verein = {
  name: "Sportverein Grünwiese",
  adresse: {
    strasse: "[Musterstraße 1]",
    plz: "[12345]",
    ort: "[Grünwiesen]",
  },
  vorstand: {
    vorsitzender: "[Max Mustermann]",
    stellvertreter: "[Erika Musterfrau]",
    kassenwart: "[Thomas Schmidt]",
  },
  kontakt: {
    telefon: "[+49 123 456789]",
    email: "[info@sv-gruenwiese.de]",
  },
  registergericht: "[Amtsgericht Musterstadt]",
  registernummer: "[VR 12345]",
};
