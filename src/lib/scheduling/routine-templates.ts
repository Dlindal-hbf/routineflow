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
    name: "Opening Routine",
    listName: "Opening Routine",
    listDescription: "Standard opening checklist before service starts.",
    color: "blue",
    frequency: "daily",
    resetTime: "07:00",
    tasks: [
      {
        name: "Inspect prep stations",
        description: "Ensure all stations are stocked and operational.",
      },
      {
        name: "Check temperatures",
        description: "Verify fridges, freezers, and hot holding temperatures.",
      },
    ],
  },
  {
    name: "Inventory Check",
    listName: "Inventory Check",
    listDescription: "Recurring inventory control routine.",
    color: "yellow",
    frequency: "weekly",
    resetTime: "10:00",
    tasks: [
      {
        name: "Count key ingredients",
        description: "Count and log critical inventory items.",
      },
      {
        name: "Flag low stock",
        description: "Record low stock items and propose reorder quantities.",
      },
    ],
  },
];
