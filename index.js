import express from 'express';
import axios from 'axios';
import * as cheerio from 'cheerio';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

const newspapers = [
  { name: 'Nasa', address: 'https://www.nasa.gov/' },
  { name: 'ISRO', address: 'https://www.isro.gov.in/' },
  { name: 'European Space Agency', address: 'https://www.esa.int/' },
];

const articles = [];

async function scrapeNewspapers() {
  for (const newspaper of newspapers) {
    try {
      const { data: html } = await axios.get(newspaper.address);
      const $ = cheerio.load(html);

      $('a').each(function () {
        const title = $(this).text().trim();
        const url = $(this).attr('href');
        if (title && url) {
          const absoluteUrl = new URL(url, newspaper.address).toString();
          articles.push({
            title,
            url: absoluteUrl,
            source: newspaper.name,
          });
        }
      });
    } catch (error) {
      console.error(`Error fetching data from ${newspaper.name}:`, error.message);
    }
  }
}

async function checkUrls(articles) {
  const results = await Promise.all(
    articles.map(async (article) => {
      try {
        const response = await axios.get(article.url, { timeout: 5000 });
        return { ...article, status: response.status, isWorking: true };
      } catch (error) {
        return {
          ...article,
          status: error.response ? error.response.status : 'Unknown Error',
          isWorking: false,
        };
      }
    })
  );
  return results;
}

function removeDuplicates(articles) {
  return Array.from(
    new Map(articles.map((article) => [`${article.title}-${article.url}`, article])).values()
  );
}

app.get('/', (req, res) => {
  res.json('Hey visit this  URLS to know more about Space and Climate');
});

app.get('/Organizations', async (req, res) => {
  if (articles.length === 0) {
    await scrapeNewspapers();
  }
  const uniqueArticles = removeDuplicates(articles);
  const checkedArticles = await checkUrls(uniqueArticles);
  const workingArticles = checkedArticles.filter((article) => article.isWorking);
  res.json(workingArticles);
});

app.get('/organization/:organizationId', async (req, res) => {
  const id = req.params.organizationId.toLowerCase();
  const newspaper = newspapers.find(
    (n) => n.name.toLowerCase() === id
  );

  if (!newspaper) {
    return res.status(404).json({ error: `No organization found with name '${id}'` });
  }

  try {
    const { data: html } = await axios.get(newspaper.address);
    const $ = cheerio.load(html);
    const specificArticles = [];

    $('a').each(function () {
      const text = $(this).text().toLowerCase();
      if (text.includes('space')) {
        const title = $(this).text().trim();
        const url = $(this).attr('href');
        const absoluteUrl = new URL(url, newspaper.address).toString();
        specificArticles.push({
          title,
          url: absoluteUrl,
          source: newspaper.name,
        });
      }
    });

    res.json(specificArticles);
  } catch (error) {
    console.error(`Error fetching data from ${newspaper.name}:`, error.message);
    res.status(500).json({ error: `Failed to fetch data from ${newspaper.name}` });
  }
});

app.listen(PORT, () =>
  console.log(`Server is running on PORT ${PORT}`)
);
