import {
  ensureDirSync,
  copySync,
  removeSync,
  readJSONSync,
  writeJsonSync
} from "fs-extra";
import chalk from "chalk";
import { get } from "request-promise-native";

var distFolder = "./dist";

var files = [
  "package.json",
  "package-lock.json",
  ".gitignore",
  "presenceDev",
  "html/pages/popup/scss",
  "html/pages/tab/scss"
];

(async () => {
  console.log(chalk.blue("Packaging..."));
  await removeSync(`${distFolder}/chrome`);
  await ensureDirSync(`${distFolder}/chrome`);

  await copySync("./Extension", `${distFolder}/chrome`);

  await Promise.all(
    files.map(f => {
      removeSync(`${distFolder}/chrome/${f}`);
    })
  );

  var manifest = await readJSONSync(`${distFolder}/chrome/manifest.json`);
  delete manifest.applications;
  await writeJsonSync(`${distFolder}/chrome/manifest.json`, manifest, {
    spaces: 2
  });

  console.log(chalk.yellow("Fetching language descriptions..."));

  JSON.parse(await get("https://api.premid.app/langFile/list")).map(
    async (l: String) => {
      var eDesc: String = JSON.parse(
        await get(`https://api.premid.app/langFile/${l}`)
      )["extension.description"];

      if (eDesc == undefined) return;
      await ensureDirSync(
        `${distFolder}/chrome/_locales/${convertLangCode(l)}`
      );
      writeJsonSync(
        `${distFolder}/chrome/_locales/${convertLangCode(l)}/messages.json`,
        {
          description: {
            message: eDesc
          }
        }
      );
    }
  );

  console.log(chalk.green("Done!"));
})();

/**
 * Convert language code to the one used by POEditor
 * @param {String} langCode Language code
 */
function convertLangCode(langCode: String) {
  langCode = langCode.toLocaleLowerCase().replace("_", "-");
  switch (langCode) {
    case "pt-pt":
      langCode = "pt";
      break;
  }

  return langCode;
}
