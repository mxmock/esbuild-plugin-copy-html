const path = require("path");
const fs = require("node:fs/promises");
const minify = require("html-minifier").minify;

const { writeFile, readFile, mkdir, readdir, stat } = fs;
const CURRENT_DIR = process.cwd();

const onEnd = async ({ htmlFrom, jsFrom, cssFrom, outDir }) => {
  try {
    if (!htmlFrom) throw new Error(`Must indicate where html come from`);
    await mkdir(outDir, { recursive: true });
    const outPath = `${CURRENT_DIR}/${outDir}`;
    const filesPath = await getFilesPath(htmlFrom);
    const pages = await readPages(filesPath, htmlFrom, outPath);

    const jsPaths = jsFrom ? await getFilesPath(jsFrom) : [];
    const cssPaths = cssFrom ? await getFilesPath(cssFrom) : [];

    for (let i = 0; i < pages.length; i++) {
      let { path, content } = pages[i];
      if (!!cssPaths.length) content = handleCss(cssPaths, path, content);
      if (!!jsPaths.length) content = handleScripts(jsPaths, path, content);
      await writeHtml(path, content);
      console.log(`Html file copied at path ${path}`);
    }
  } catch (e) {
    console.error(`copyHtmlPlugin error - onEnd - ${e.message}`);
  }
};

const getFilesPath = async (dir) => {
  const dirents = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    dirents.map((dirent) => {
      const res = path.resolve(dir, dirent.name);
      return dirent.isDirectory() ? getFilesPath(res) : res;
    })
  );
  return Array.prototype.concat(...files);
};

const readPages = async (htmlPaths, htmlFromDir, outDirPath) => {
  const pagesPromises = htmlPaths.map((htmlPath) => {
    return new Promise((resolve, reject) => {
      readFile(htmlPath, "utf8")
        .then((c) => {
          if (!c) reject(`Can't read file ${htmlPath}`);
          const path = getHtmlOutputPath(htmlPath, htmlFromDir, outDirPath);
          let content = minify(c, {
            caseSensitive: true,
            collapseWhitespace: true,
            conservativeCollapse: true,
          });
          resolve({ path, content });
        })
        .catch((e) => reject(e));
    });
  });
  const pages = await Promise.all(pagesPromises);
  return pages;
};

const getHtmlOutputPath = (filePath, htmlFromDir, outPath) => {
  const dirArr = `${CURRENT_DIR}/${htmlFromDir}`.split("/");
  const arr = filePath.split("/");
  const path = arr.filter((n) => !dirArr.includes(n)).join("/");
  return `${outPath}/${path}`;
};

const handleCss = (cssPaths, htmlPath, content) => {
  let updated = content;
  updated = removeLinks(updated, `<link rel="stylesheet"`, `css">`);
  const css = cssPaths.map((p) => getRelativePath(p, htmlPath)).map(createLink);
  css.forEach((el) => {
    updated = insertLink(updated, el);
  });
  return updated;
};

const handleScripts = (jsPaths, htmlPath, content) => {
  let updated = content;
  updated = removeLinks(updated, `<script`, `</script>`);
  const js = jsPaths.map((p) => getRelativePath(p, htmlPath)).map(createScript);
  js.forEach((el) => {
    updated = insertLink(updated, el);
  });
  return updated;
};

const removeLinks = (content, startTerm, endTerm) => {
  let updated = content;
  while (updated.includes(startTerm)) {
    const indexesStart = findIndexesInString(updated, startTerm);
    const indexesEnd = findIndexesInString(updated, endTerm);
    updated = getRemovedContent(
      updated,
      indexesStart[0],
      indexesEnd[0],
      endTerm.length
    );
  }
  return updated;
};

const findIndexesInString = (string, toFind) =>
  [...string.matchAll(new RegExp(toFind, "gi"))].map((a) => a.index);

const getRemovedContent = (content, startIndex, endIndex, endTermLength) => {
  const beforeScript = content.substring(0, startIndex);
  const afterScript = content.substring(endIndex + endTermLength);
  return `${beforeScript}${afterScript}`;
};

const getRelativePath = (linkPath, htmlPath) => {
  const htmlAfterRoot = getPathAfterRoot(htmlPath, linkPath);
  const relativeDots = getRelativeDots(htmlAfterRoot.length);
  const linkAfterRoot = getPathAfterRoot(linkPath, htmlPath);
  return [relativeDots, ...linkAfterRoot].join("/");
};

const getPathAfterRoot = (path1, path2) => {
  const pathArr1 = path1.split("/");
  const pathArr2 = path2.split("/");
  return pathArr1.reduce(
    (prev, p1, i) => (pathArr2[i] === p1 ? [...prev] : [...prev, p1]),
    []
  );
};

const getRelativeDots = (pathLength) => {
  const length = pathLength - 1;
  if (length === 0) return ".";
  let relativePath = "";
  for (let i = 0; i < length; i++) {
    relativePath += "../";
  }
  return relativePath.slice(0, -1);
};

const createScript = (link) => `<script src="${link}"></script>`;
const createLink = (link) => `<link rel="stylesheet" href="${link}">`;

const insertLink = (content, link) => {
  const head = content.indexOf("</head>");
  const beforeHead = content.substring(0, head);
  const afterHead = content.substring(head);
  return `${beforeHead}${link}${afterHead}`;
};

const writeHtml = async (htmlPath, content) => {
  const folder = path.dirname(htmlPath);
  const isDir = await isFolder(folder);
  if (!isDir) await mkdir(folder, { recursive: true });
  await writeFile(htmlPath, content);
};

const isFolder = async (path) => {
  const result = await stat(path).catch((err) => {
    if (isErrorNotFound(err)) {
      return false;
    }
    throw err;
  });
  return !result ? result : result.isDirectory();
};

const isErrorNotFound = (err) => err.code === "ENOENT";

const stringFilled = (s) => typeof s === "string" && s.length > 0;

module.exports = (options = {}) => {
  const htmlFrom = stringFilled(options.htmlFromDir)
    ? options.htmlFromDir
    : null;
  const jsFrom = stringFilled(options.jsFromDir) ? options.jsFromDir : null;
  const cssFrom = stringFilled(options.cssFromDir) ? options.cssFromDir : null;
  const outDir = options.outDir || "out";
  return {
    name: "copyHtmlPlugin",
    setup: (build) => {
      build.onEnd(async (r) => {
        await onEnd({ htmlFrom, jsFrom, cssFrom, outDir });
      });
    },
  };
};
