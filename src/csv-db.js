import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import path from 'path';

const dataDir = path.join(process.cwd(), ".data");
const linksFile = path.join(dataDir, "links.csv");
const hitsFile = path.join(dataDir, "hits.csv");

// Ensure data directory exists
if (!existsSync(dataDir)) {
  mkdirSync(dataDir, { recursive: true });
}

// CSV Headers
const LINKS_HEADERS = ['id', 'key_hash', 'url', 'user_ip', 'spoo_url', 'created_at'];
const HITS_HEADERS = ['id', 'link_id', 'ip_data', 'timestamp'];

// Initialize CSV files if they don't exist
function initializeCSVFile(filePath, headers) {
  if (!existsSync(filePath)) {
    const csvContent = stringify([headers]);
    writeFileSync(filePath, csvContent);
  }
}

initializeCSVFile(linksFile, LINKS_HEADERS);
initializeCSVFile(hitsFile, HITS_HEADERS);

// Helper functions to read and write CSV files
function readCSV(filePath, headers) {
  try {
    const content = readFileSync(filePath, 'utf-8');
    if (!content.trim()) {
      return [];
    }
    const records = parse(content, {
      columns: headers,
      skip_empty_lines: true,
      skip_records_with_error: true
    });
    // Remove header row if it exists
    return records.filter(record => record.id !== 'id');
  } catch (error) {
    console.error(`Error reading CSV file ${filePath}:`, error);
    return [];
  }
}

function writeCSV(filePath, data, headers) {
  try {
    const csvContent = stringify([headers, ...data.map(record => 
      headers.map(header => record[header] || '')
    )]);
    writeFileSync(filePath, csvContent);
  } catch (error) {
    console.error(`Error writing CSV file ${filePath}:`, error);
    throw error;
  }
}

// Generate unique ID for hits
function generateHitId() {
  const hits = readCSV(hitsFile, HITS_HEADERS);
  const maxId = hits.reduce((max, hit) => {
    const id = parseInt(hit.id) || 0;
    return id > max ? id : max;
  }, 0);
  return (maxId + 1).toString();
}

export const csvQueries = {
  // Links operations
  insertLink: (id, keyHash, url, userIp, spooUrl) => {
    const links = readCSV(linksFile, LINKS_HEADERS);
    const newLink = {
      id,
      key_hash: keyHash,
      url,
      user_ip: userIp,
      spoo_url: spooUrl || '',
      created_at: new Date().toISOString()
    };
    links.push(newLink);
    writeCSV(linksFile, links, LINKS_HEADERS);
    return newLink;
  },

  findLinkById: (id) => {
    const links = readCSV(linksFile, LINKS_HEADERS);
    return links.find(link => link.id === id) || null;
  },

  deleteLinkById: (id) => {
    const links = readCSV(linksFile, LINKS_HEADERS);
    const filteredLinks = links.filter(link => link.id !== id);
    writeCSV(linksFile, filteredLinks, LINKS_HEADERS);
    return true;
  },

  // Hits operations
  insertHit: (linkId, ipData) => {
    const hits = readCSV(hitsFile, HITS_HEADERS);
    const newHit = {
      id: generateHitId(),
      link_id: linkId,
      ip_data: ipData,
      timestamp: new Date().toISOString()
    };
    hits.push(newHit);
    writeCSV(hitsFile, hits, HITS_HEADERS);
    return newHit;
  },

  getHits: (linkId) => {
    const hits = readCSV(hitsFile, HITS_HEADERS);
    return hits
      .filter(hit => hit.link_id === linkId)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  },

  deleteHitsByLinkId: (linkId) => {
    const hits = readCSV(hitsFile, HITS_HEADERS);
    const filteredHits = hits.filter(hit => hit.link_id !== linkId);
    writeCSV(hitsFile, filteredHits, HITS_HEADERS);
    return true;
  },

  deleteHit: (hitId) => {
    const hits = readCSV(hitsFile, HITS_HEADERS);
    const filteredHits = hits.filter(hit => hit.id !== hitId.toString());
    writeCSV(hitsFile, filteredHits, HITS_HEADERS);
    return true;
  }
};
