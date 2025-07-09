import { csvQueries } from "./csv-db.js";
import {
  generateUniqueId,
  generateString,
  validateUrl,
  tryAsync,
} from "./utils.js";

export const createLink = async ({ url, userIp }) => {
  if (url.length > 1_000) {
    throw new Error("URL too long");
  }

  if (!validateUrl(url)) {
    throw new Error("Invalid URL");
  }

  const id = generateUniqueId((id) => csvQueries.findLinkById(id));
  const key = generateString(50);
  const keyHash = await Bun.password.hash(key);

  const spooUrl = await tryAsync(async () => {
    const response = await fetch("https://spoo.me/", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: new URLSearchParams({
        url: `${process.env.HOSTNAME}/${id}`,
        alias: "",
        password: "",
        "max-clicks": "",
      }),
    });
    const data = await response.json();
    return data.short_url;
  });

  csvQueries.insertLink(id, keyHash, url, userIp, spooUrl);

  return { slug: id, key };
};

export const getLink = async ({ slug, key }) => {
  const record = csvQueries.findLinkById(slug);

  if (!record) {
    throw new Error("Link not found");
  }

  const isValidKey = await Bun.password.verify(key, record.key_hash);
  if (!isValidKey) {
    throw new Error("Invalid key");
  }

  const hits = csvQueries.getHits(slug).map((hit) => ({
    ...hit,
    ip_data: hit.ip_data ? JSON.parse(hit.ip_data) : null,
  }));

  return {
    url: record.url,
    hits,
    masked: {
      spoodotme: record.spoo_url,
    },
  };
};

export const deleteLink = async ({ slug, key }) => {
  const record = csvQueries.findLinkById(slug);

  if (!record) {
    throw new Error("Link not found");
  }

  const isValidKey = await Bun.password.verify(key, record.key_hash);
  if (!isValidKey) {
    throw new Error("Invalid key");
  }

  csvQueries.deleteLinkById(slug);
  csvQueries.deleteHitsByLinkId(slug);
  
  return { success: true };
};

export const recordHit = async ({ id, ipData, userIp }) => {
  const record = csvQueries.findLinkById(id);

  if (!record) {
    throw new Error("Link not found");
  }

  const geoData = await tryAsync(async () => {
    const response = await fetch(
      `https://tools.keycdn.com/geo.json?host=${userIp}`,
      {
        headers: {
          "User-Agent": `keycdn-tools:${process.env.HOSTNAME}`,
        },
      }
    );
    const data = await response.json();
    return data.data.geo;
  });

  csvQueries.insertHit(id, JSON.stringify({ ...ipData, ip: geoData }));

  return { url: record.url };
};

export const deleteMe = async ({ slug, ip }) => {
  const hits = csvQueries.getHits(slug);

  if (!hits?.length) {
    return { ok: false };
  }

  const hit = hits.find((hit) => {
    return JSON.parse(hit.ip_data).ip.ip === ip;
  });

  if (!hit?.id) {
    return { ok: false };
  }

  csvQueries.deleteHit(hit.id);

  return { ok: true };
};
