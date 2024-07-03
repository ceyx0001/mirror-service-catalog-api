import axios from "axios";
import { load } from "cheerio";
import { Request, Response, NextFunction } from "express";
import asyncHandler from "express-async-handler";

export type Thread = {
  profileName: string;
  index: number;
  views: number;
  title: string;
};

export const getThreadsData = async (
  startPage: number = 1,
  endPage: number = 50
) => {
  const threads = new Map<string, Thread>();
  const urlSelling = `https://www.pathofexile.com/forum/view-forum/standard-trading-selling`;
  const urlShops = `https://www.pathofexile.com/forum/view-forum/standard-trading-shops`;
  const urls = [urlSelling, urlShops];

  const promises = urls.flatMap((url) =>
    Array.from({ length: endPage - startPage + 1 }, async (_, i) => {
      const pageUrl = `${url}/page/${i + startPage}`;
      try {
        const response = await axios.get(pageUrl, {
          headers: {
            "User-Agent": `Mirror-Catalog/1.0 (${process.env.DEV_EMAIL}) Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3`,
          },
        });
        const document = load(response.data);
        document("td.thread").each((i, elem) => {
          try {
            const threadElem = document(elem);
            const anchor = threadElem
              .children(".thread_title")
              .children(".title")
              .children("a");
            const shopTitle = anchor.text().trim();
            if (
              shopTitle.toLowerCase().includes("mirror") &&
              (shopTitle.toLowerCase().includes("service") ||
                shopTitle.includes("shop"))
            ) {
              const thread: Thread = {
                profileName: threadElem
                  .children(".postBy")
                  .children(".post_by_account")
                  .children("a")
                  .text()
                  .trim(),
                index: parseInt(anchor.attr("href").replace(/\D/g, "")),
                views: parseInt(
                  threadElem
                    .siblings(".views")
                    .children(".post-stat")
                    .children("span")
                    .text()
                ),
                title: shopTitle,
              };
              threads.set(thread.profileName, thread);
            }
          } catch (error) {
            console.log(error);
          }
        });
      } catch (error) {
        console.log(error);
      }
    })
  );
  await Promise.all(promises);

  return Array.from(threads.values());
};

export const getThreads = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const data = await getThreadsData(req.query?.startPage, req.query?.endPage);
    if (data.length === 0) {
      const err: any = new Error("No mirror threads found.");
      err.status(400);
      next(err);
    }
    return res.json(data);
  }
);
