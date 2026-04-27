import Papa from 'papaparse';
import { DeliveryData } from '../data';

const BASE_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQdvPPg-o1ppWAbxeJ_2PRFRIiHPFQq8UCfMsGMkT7zMxY-bQcln5a06VQ2EQo9Tg/pub";

export type OperationType = 'import' | 'export';

const GIDS = {
  import: null, 
  export: "1895360170"
};

export async function fetchLogisticsData(type: OperationType = 'import'): Promise<DeliveryData[]> {
  const url = type === 'import' 
    ? `${BASE_URL}?output=csv` 
    : `${BASE_URL}?gid=${GIDS[type]}&single=true&output=csv`;
  
  return new Promise((resolve, reject) => {
    Papa.parse(url, {
      download: true,
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const rawData = results.data as any[];
        
        // Helper to normalize strings for comparison (remove accents, lowercase, trim)
        const normalize = (str: string) => 
          str.toLowerCase()
             .normalize("NFD")
             .replace(/[\u0300-\u036f]/g, "")
             .trim();

        const findValue = (row: any, ...keys: string[]) => {
          const rowKeys = Object.keys(row);
          const normalizedKeysToSearch = keys.map(normalize);
          
          for (const rowKey of rowKeys) {
            const normalizedRowKey = normalize(rowKey);
            if (normalizedKeysToSearch.some(k => normalizedRowKey === k || normalizedRowKey.includes(k))) {
              return row[rowKey];
            }
          }
          return undefined;
        };

        const mappedData: DeliveryData[] = rawData
          .map((row) => {
            const dateDep = findValue(row, "date de depotage", "datedepotage", "date");
            const transporteur = findValue(row, "transporteur", "transp");
            
            if (!dateDep && !transporteur) return null;

            return {
              dateDepotage: dateDep || "",
              mois: findValue(row, "mois") || "",
              semaine: parseInt(findValue(row, "semaine")) || 0,
              remorque: findValue(row, "remorque") || "",
              voyage: findValue(row, "voyage") || "",
              position: findValue(row, "position") || "",
              expediteur: findValue(row, "expediteur", "exped", "exp") || "",
              destinataire: findValue(row, "destinataire", "destinateire", "dest") || "",
              nbreColis: parseFloat(String(findValue(row, "nbre colis", "nbr colis", "nombre colis") || "0").replace(',', '.')) || 0,
              poids: parseFloat(String(findValue(row, "poids", "poids brut", "poidsbrut") || "0").replace(/\s/g, '').replace(',', '.')) || 0,
              mpl: parseFloat(String(findValue(row, "mpl") || "0").replace(',', '.')) || 0,
              typeColis: findValue(row, "type colis", "nature", "type de colis") || "",
              incoterm: findValue(row, "incoterm") || "",
              zone: findValue(row, "zone") || "",
              declaration: findValue(row, "declaration") || "",
              status: findValue(row, "status", "statut") || "",
              tourne: parseInt(findValue(row, "tourne")) || 0,
              transporteur: transporteur || "",
              typeLivraison: findValue(row, "type livraison") || "",
              nVehicule: findValue(row, "vehicule", "n vehicule") || "",
              dateSortie: findValue(row, "date de sortie", "sortie") || "",
              nreJour: parseInt(findValue(row, "nre jour", "jour")) || 0,
              prixHT: parseFloat(String(findValue(row, "prix ht", "prix") || "0").replace(/\s/g, '').replace(',', '.')) || 0,
              expDest: findValue(row, "exp/dest") || "",
              reference: findValue(row, "reference", "ref") || "",
              observations: findValue(row, "observations", "obs") || ""
            };
          })
          .filter((item): item is DeliveryData => item !== null);

        resolve(mappedData);
      },
      error: (error) => {
        reject(error);
      }
    });
  });
}
