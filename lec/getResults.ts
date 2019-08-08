import puppeteer from "puppeteer";
import moment, { Moment } from "moment";

import { options, args } from "./options";
// import { getHistoricalGames } from "./getGames";


type TObjective = "blood" | "turret" | "dragon" | "baron" | "herald";

interface IFirstObjective {
  team: "blue" | "red" | null;
  objective: TObjective;
}

interface ITeams {
  blueTeam: string;
  redTeam: string;
}

const getGameDate = async (page: puppeteer.Page): Promise<{ date: Moment }> => {
  const date = await page.$eval(".map-header-date", (_el: Element) => {
    const el = _el as HTMLDivElement
    return el.innerText.trim();
  });

  return { date: moment(date, "M/D/YYYY") };
};

const getFirstObjective = async (
  page: puppeteer.Page,
  objective: TObjective
): Promise<IFirstObjective> => {
  page.evaluate(`
    Object.defineProperty(
      window, 
      'objective', { 
        get() { 
          return '${objective}' 
        }
      })
  `);

  const firstObjective = await page.$$eval<IFirstObjective>(
    "image",
    (_images: Element[]) => {
      const images = _images as SVGImageElement[]

      const first = images.reduce<SVGImageElement | null>((acc, image) => {
        if (!image.href.baseVal.includes(`${objective}_`)) {
          return acc;
        }

        if (!acc) {
          // found the first candidate

          if (image.href.baseVal.includes(`${objective}_`)) {
            return image;
          }

          return null
        }

        if (image.x.baseVal < acc.x.baseVal) {
          return image;
        }

        return acc;
      }, null);

      if (!first) {
        // throw new Error(`Element not found for ${objective}`)
        return {
          team: null,
          objective
        }
      }

      return {
        team: first
          ? first.href.baseVal.includes("100")
            ? "blue"
            : "red"
          : null,
        objective
      };
    }
  );

  return firstObjective;
};

const getTeams = async (page: puppeteer.Page): Promise<ITeams> => {
  const teams = await page.$$eval<ITeams>(
    ".champion-nameplate-name",
    (_els: Element[]) => {
      const els = _els as HTMLDivElement[]
      // champion names are formatted SK Sacre. So we get the first and last, since blue is always LHS and red RHS.
      // elements 0-4 are blue, and 5-9 are red.
      return {
        blueTeam: els[0].innerText.split(" ")[0],
        redTeam: els[9].innerText.split(" ")[0]
      };
    }
  );

  return teams;
};

const getResults = async (matchHistoryLink: string) => {
  const browser: puppeteer.Browser = await puppeteer.launch({
    ...options,
    headless: true
  });
  const page = await browser.newPage();
  await page.setUserAgent(
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/68.0.3419.0 Safari/537.36"
  );

  await page.goto(matchHistoryLink, { waitUntil: "load" });
  // this is the container with the timeline containing first blood, dragon etc...
  // const rendered = await page.waitForSelector("#graph-switcher-262-container");
  await page.waitForSelector(".team-100-kills-bg");

  const objectiveToScrape = "herald";

  const { blueTeam, redTeam } = await getTeams(page);
  const { objective, team } = await getFirstObjective(page, objectiveToScrape);
  const { date } = await getGameDate(page);

  console.log(date.format("DD-MM-YYYY"));
};

(async () => {
  await getResults(
    "https://matchhistory.na.leagueoflegends.com/en/#match-details/ESPORTSTMNT04/990663?gameHash=31d15a7905470d96"
    // "https://matchhistory.na.leagueoflegends.com/en/#match-details/ESPORTSTMNT04/990638?gameHash=f5ea274ad9ef38ef&tab=overview"
  );
})();
