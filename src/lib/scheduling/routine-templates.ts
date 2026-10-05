export type RoutineTemplateDefinition = {
  name: string;
  listName: string;
  listDescription?: string;
  color?: string;
  frequency?: "none" | "daily" | "weekly" | "biweekly" | "monthly";
  resetTime?: string;
  tasks: Array<{
    name: string;
    description?: string;
  }>;
};

export const ROUTINE_TEMPLATES: RoutineTemplateDefinition[] = [
  {
    name: "Stengerutiner",
    listName: "Stengerutiner",
    listDescription: "Rutiner for stenging. Alt skal være fullført før butikken stenges.",
    color: "red",
    frequency: "daily",
    resetTime: "06:00",
    tasks: [
      {
        name: "Tørrmoppe gulv",
        description: "",
      },
      {
        name: "Såpevaske gulv",
        description: "Rene mopper og såpevann",
      },
     {
        name: "Vask slushmaskin",
        description: "Om den er brukt",
     },
     {
        name: "Sjekk bestillinger til neste dag",
        description: "Heng bestillingene med garnityren slik at de på skift neste morgen ser det"
        },
      {
        name: "Slå av alt utstyr",
        description: "Ovn, varmaskap, lader til varmebag, garnity oppe, radio"

      }, 
      {
        name: "Vask dør til kjøl",
        description: "Håndtak inne og ute"
      },
      { 
        name: "Fyll ut ost- og bunnskjema",
        description: "Avvik skal noteres og forklares"
      },
      {
        name: "Ta opp kjøtt",
        description: "Legg det eldste kjøttet øverst og tydeligst. Følg lister for mengde kjøtt"
      },
      {
        name: "Telle bunner og ost",
        description: "Alle stativ telles og får posen trekket skikkelig over med klype"
      },
      {
        name: "Kuttebenk ryddes og vaskes",
        description: "Det som ikke trenger å være der flyttes på plass eller kastes"
      }, 
      {
        name: "Bakeområdet vaskes",
        description: "Alt på benkene flyttes på for å få vasket skikkelig"
      },
      {
        name: "Tøm oppvaskmaskinen",
        description: "Gjør når alt annet er ferdig. Hold inne tømmeknappen i 3 sekunder"   
      },
      {
        name: "Oppvask",
        description: "Alt skal være vasket og satt på plass til stengingen. Tøm sluk for rester. Oppvaskbenken og veggen vaskes til slutt"
      },
      {
        name: "Lås og sett bil på lading",
        description: "Ryddes for søppel og kortterminalen tas med inn"
      },
      {
        name: "Kast søppel og papp",
        description: "Trykk på grønn knapp på dunk for resstavfall for å komprimere"
      },
      {
        name: "Ta inn gatebukk og flagg",
        description: ""
      },
      {
        name: "Mattene vaskes så godt det går",
        description: "Skrap/tørk av og spyl med vann ute"
      },
      {
        name: "Vask garnityr grundig",
        description: "Vask håndtak på skuffer og dører. Sausflekker på toppen og sidene av garnityren skal vekk. Hyllen på toppen skal vaskes og ryddes for diverse rot"
      },
      {
        name: "Rydde disken",
        description: "Telefoner, penner, notatblokker, og annet rot ryddes bort og legges på plass"
      },
      {
        name: "Vaske kuttehjørnet",
        description: "Flytt på alt som står på benk og hylle og vask over med klut. Kuttebenk flyttes og veggen bak vaskes"
      },
      {
        name: "Vask ovnen med begge åpningene",
        description: ""
      }
      
       
    ],
  },
  {
    name: "Åpningsrutine",
    listName: "Åpningsrutine",
    listDescription: "Standard sjekkliste før åpning.",
    color: "red",
    frequency: "daily",
    resetTime: "06:00",
    tasks: [
      {
        name: "Kontroller prepstasjoner",
        description: "Sørg for at alle stasjoner er fylt opp og klare.",
      },
      {
        name: "Sjekk temperaturer",
        description: "Kontroller temperatur i kjøl, frys og varmeholding.",
      },
    ],
  },
  {
    name: "Lagerkontroll",
    listName: "Lagerkontroll",
    listDescription: "Fast rutine for lagerkontroll.",
    color: "red",
    frequency: "weekly",
    resetTime: "10:00",
    tasks: [
      {
        name: "Tell nøkkelvarer",
        description: "Tell og loggfør kritiske lagervarer.",
      },
      {
        name: "Marker lav beholdning",
        description: "Registrer varer med lav beholdning og foreslå bestillingsmengde.",
      },
    ],
  },
];
