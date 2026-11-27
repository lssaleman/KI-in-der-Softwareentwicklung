export interface Veranstaltung {
  id: string;
  titel: string;
  datum: Date;
  beschreibung: string;
}

export const VERANSTALTUNGEN: Veranstaltung[] = [
  {
    id: "saisonauftakt-2027",
    titel: "Saisonauftakt der Fußballabteilung",
    datum: new Date(2027, 2, 15),
    beschreibung:
      "Der Verein Grünwiese lädt alle Mitglieder, Familien und Sportinteressierten zum offiziellen Saisonauftakt der Fußballabteilung ein. Auf dem Vereinsgelände präsentieren die Mannschaften ihre Ziele für die kommende Spielzeit und geben spannende Einblicke in den Trainingsalltag.",
  },
  {
    id: "handball-cup-2027",
    titel: "Handball-Cup Grünwiese 2027",
    datum: new Date(2027, 4, 22),
    beschreibung:
      "Beim Handball-Cup Grünwiese treffen Mannschaften aus der Region aufeinander und sorgen für spannende Begegnungen in der Sporthalle des Vereins.",
  },
  {
    id: "basketball-sommercamp-2027",
    titel: "Basketball-Sommercamp",
    datum: new Date(2027, 6, 10),
    beschreibung:
      "Das Basketball-Sommercamp des Vereins Grünwiese richtet sich an Kinder, Jugendliche und junge Erwachsene, die ihre sportlichen Fähigkeiten verbessern möchten.",
  },
  {
    id: "tag-der-offenen-tuer-2027",
    titel: "Tag der offenen Tür beim Verein Grünwiese",
    datum: new Date(2027, 8, 18),
    beschreibung:
      "Der Verein Grünwiese öffnet seine Türen für alle Interessierten und präsentiert die vielfältigen Sportangebote in den Bereichen Fußball, Basketball und Handball.",
  },
  {
    id: "jahresabschluss-basketball-2027",
    titel: "Erfolgreicher Jahresabschluss der Basketballmannschaften",
    datum: new Date(2027, 11, 5),
    beschreibung:
      "Die Basketballmannschaften des Vereins Grünwiese blicken auf eine erfolgreiche Saison zurück. Zahlreiche Siege, starke Teamleistungen und die positive Entwicklung vieler Nachwuchsspieler prägten das Sportjahr.",
  },
  {
    id: "winterturnier-2028",
    titel: "Vereinsübergreifendes Winterturnier",
    datum: new Date(2028, 1, 20),
    beschreibung:
      "Beim vereinsübergreifenden Winterturnier des Vereins Grünwiese treten Fußball-, Handball- und Basketballmannschaften in verschiedenen Wettbewerben gegeneinander an.",
  },
];
