import axios from "axios";
import { load } from "cheerio";
import asyncHandler from "express-async-handler";
import { Request, Response } from "express";
import { char } from "drizzle-orm/mysql-core";

const getShopData = async (index) => {
  const headers = {
    headers: {
      "User-Agent": `Mirror-Catalog/1.0.0 (contact:/${process.env.DEV_EMAIL}) StrictMode`,
    },
  };

  try {
    // clean response into array of JSON objects
    let serviceItems = [];
    const threadUrl = `https://www.pathofexile.com/forum/view-thread/${index}`;
    const threadResponse = await axios.get(threadUrl, headers);
    const threadDocument = load(threadResponse.data);
    const scriptContent = threadDocument("script")
      .last()
      .html()
      .replace(/\s\s+|\n/g, "");
    const profileName = threadDocument("tr .post_info .posted-by .profile-link")
      .first()
      .text();

    const contentString = threadDocument(".content-container").first().text();
    let characterName = null;
    let fees = [];
    let feeindex = 0;
    if (contentString) {
      let ign = contentString.match(/IGN:\s(\S*)/i);
      if (ign) {
        characterName = ign[1];
      }
      let at = contentString.match(/@(\S*)/i);
      if (at) {
        characterName = at[1];
      }

      const feesString = contentString.match(/Fee: (\d+)/gi);
      if (feesString) {
        feesString.forEach((feeString) =>
          fees.push(parseInt(feeString.split(":")[1].trim()))
        );
      }
    }

    //const apiUrl = `http://www.pathofexile.com/character-window/get-characters?accountName=${profileName}`;
    //const characterResponse = (await axios.get(apiUrl, headers)).data;
    /*for (const character of characterResponse) {
      if (character.league === "Standard") {
        characterName = character.name;
        break;
      }
    } implemenet rate limit */

    if (scriptContent.includes("DeferredItemRenderer")) {
      const arrayStartIndex = scriptContent.indexOf("new R(") + 6; // clean string
      const arrayEndIndex = scriptContent.indexOf(".run()") - 2;
      const arrayString = scriptContent.slice(arrayStartIndex, arrayEndIndex);
      serviceItems = JSON.parse(arrayString)
        .map((item) => {
          if (
            item[1].name !== "" &&
            !("duplicated" in item[1]) &&
            item[1].rarity !== "Unique" &&
            !item[1].baseType.includes(" Jewel") &&
            !item[1].baseType.includes("Map")
          ) {
            try {
              let itemQuality;
              if (item[1].properties) {
                const qualityArray = item[1].properties.find((property) =>
                  /^Quality.*/.test(property.name)
                );
                if (qualityArray) {
                  itemQuality = qualityArray.values[0][0].replace(/\D/g, "");
                }
              }
              let fee = null;
              if (feeindex < fees.length) {
                fee = fees[feeindex];
              }
              return {
                id: item[1].id,
                fee: fee,
                icon: item[1].icon,
                name: item[1].name,
                baseType: item[1].baseType,
                quality: itemQuality || null,
                enchantMods: item[1].enchantMods || null,
                implicitMods: item[1].implicitMods || null,
                explicitMods: item[1].explicitMods || null,
                fracturedMods: item[1].fracturedMods || null,
                craftedMods: item[1].craftedMods || null,
                crucibleMods: item[1].crucibleMods || null,
              };
            } catch (error) {
              console.error(error);
              console.error(item[1].properties);
              console.error(index);
            }
          }
        })
        .filter(Boolean);
    }

    return {
      profileName: profileName,
      characterName: characterName,
      threadIndex: parseInt(index),
      items: serviceItems,
    };
  } catch (error) {
    console.log(error);
  }
};

const shop = asyncHandler(async (req: Request, res: Response) => {
  if (res) {
    const data = await getShopData(req.params.threadIndex);
    return res.json(data);
  } else {
    const data = await getShopData(req);
    return data;
  }
});

export default shop;
