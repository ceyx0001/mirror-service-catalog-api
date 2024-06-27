import axios from "axios";
import cheerio from "cheerio";
import { Request, NextFunction } from "express";

export const getThreadsData = async (req: Request, next: NextFunction) => {
  req.startPage = parseInt(req.query.startPage, 10) || 1;
  req.endPage = parseInt(req.query.endPage, 10) || 50;
  let threads = [];
  if (req.startPage > req.endPage) {
    const err: any = new Error(
      "Page number to start indexing threads is greater than the last page."
    );
    err.status(400);
    next(err);
  }

  const promises = Array.from(
    { length: req.endPage - req.startPage + 1 },
    async (_, i) => {
      const url = `https://www.pathofexile.com/forum/view-forum/standard-trading-shops/page/${
        i + req.startPage
      }`;
      const response = await axios.get(url, {
        headers: {
          "User-Agent": `Mirror-Catalog/1.0 (${process.env.DEV_EMAIL}) Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3`,
        },
      });

      const document = cheerio.load(response.data);
      document("tr .title a").each((i, elem) => {
        try {
          const element = document(elem);
          const shopTitle = element.text().toLowerCase().trim();
          if (
            shopTitle.includes("mirror") &&
            (shopTitle.includes("service") || shopTitle.includes("shop"))
          ) {
            const thread = {
              index: parseInt(document(elem).attr("href").replace(/\D/g, "")),
              views: parseInt(
                document(elem)
                  .closest("td.thread")
                  .next()
                  .find("div.post-stat")
                  .text()
                  .replace(/\D/g, "")
              ),
              title: shopTitle,
            };
            threads.push(thread);
          }
        } catch (error) {
          console.log(error);
        }
      });
    }
  );

  await Promise.all(promises);

  if (threads.length === 0) {
    const err: any = new Error("No mirror threads found.");
    err.status(400);
    next(err);
  }
  threads.sort();
  return threads;
};

export const threads = async (req: Request, next: NextFunction) => {
  return await getThreadsData(req, next);
};
