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

export type ThreadsQuery = {
  startPage?: number;
  endPage?: number;
};

const urlSelling = `https://www.pathofexile.com/forum/view-forum/standard-trading-selling`;
const urlShops = `https://www.pathofexile.com/forum/view-forum/standard-trading-shops`;
const urls = [urlSelling, urlShops];

export const getThreadsData = async (
  startPage: number = 1,
  endPage: number = 50
) => {
  if (startPage < 1) throw new Error("Start page must be >= 1");
  if (endPage < startPage) throw new Error("End page must be >= start page");
  if (endPage - startPage > 100) throw new Error("Maximum page range exceeded");

  const threads = new Map<string, Thread>();

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
                shopTitle.toLowerCase().includes("shop"))
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
            throw new Error("Failed to fetch threads: " + error.message);
          }
        });
      } catch (error) {
        throw new Error("Failed to fetch threads: " + error.message);
      }
    })
  );
  await Promise.all(promises);

  return Array.from(threads.values());
};

export const getThreads = asyncHandler(
  async (req: Request<{}, {}, {}, ThreadsQuery>, res: Response) => {
    const startPage = Number(req.query?.startPage) || 1;
    const endPage = Number(req.query?.endPage) || 50;

    try {
      const data = await getThreadsData(startPage, endPage);

      if (data.length === 0) {
        return res.status(404).json({
          error: "No mirror threads found",
        });
      }

      res.setHeader("Cache-Control", "public, max-age=300");
      return res.json({
        success: true,
        data,
        meta: {
          total: data.length,
          startPage,
          endPage,
        },
      });
    } catch (error) {
      return res.status(500).json({
        error: "Failed to fetch threads",
        message: error.message,
      });
    }
  }
);
