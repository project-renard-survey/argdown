var extendMarkdown = require("./extendMarkdown");
var domain = "https://argdown.org";

module.exports = {
  title: "Argdown",
  description:
    "Argdown is a simple syntax for complex argumentation. Writing lists of pros & cons in Argdown is as simple as writing a twitter message, but you can also use it to logically reconstruct whole debates and visualize them as argument maps.",
  base: "/",
  head: [
    [
      "link",
      {
        rel: "shortcut icon",
        type: "image/x-icon",
        href: `${domain}/favicon.ico`
      }
    ],
    [
      "link",
      {
        rel: "icon",
        type: "image/png",
        href: `${domain}/favicon-32x32.png`,
        sizes: "32x32"
      }
    ],
    [
      "link",
      {
        rel: "icon",
        type: "image/png",
        href: `${domain}/favicon-16x16.png`,
        sizes: "16x16"
      }
    ],
    ["link", { rel: "manifest", href: `${domain}/site.webmanifest` }],
    [
      "link",
      {
        rel: "apple-touch-icon-precomposed",
        href: `${domain}/apple-touch-icon.png`
      }
    ]
  ],
  plugins: [
    [
      "@vuepress/pwa",
      {
        serviceWorker: true,
        updatePopup: true
      }
    ],
    [
      "sitemap",
      {
        hostname: "https://pake.web.id"
      }
    ]
  ],
  markdown: {
    extendMarkdown: extendMarkdown
  },
  themeConfig: {
    repo: "christianvoigt/argdown",
    docsDir: "docs",
    algolia: {
      apiKey: "6f7a8a8ebb4447a94088be7ef719ea1f",
      indexName: "argdown"
    },
    sidebar: {
      "/changes/": [
        {
          title: "Changes",
          children: [["", "2019"], ["2018", "2018"]]
        }
      ],
      "/guide/": [
        {
          title: "Getting started",
          children: [
            ["", "Introduction"],
            "installing-the-vscode-extension",
            "installing-the-commandline-tool",
            "a-first-example"
          ]
        },
        {
          title: "Creating argument maps",
          children: [
            ["creating-argument-maps", "Introduction"],
            "elements-of-an-argument-map",
            "changing-the-graph-layout",
            "creating-statement-and-argument-nodes",
            "creating-edges",
            "creating-group-nodes",
            "changing-the-node-style",
            "changing-the-node-size",
            "colorizing-maps"
          ]
        },
        {
          title: "Configuration",
          children: [
            ["configuration", "Introduction"],
            "configuration-with-config-files",
            "configuration-in-the-frontmatter-section",
            "running-custom-processes",
            "configuration-cheatsheet"
          ]
        },
        {
          title: "Extending Argdown",
          children: [
            ["extending-argdown", "Introduction"],
            "writing-custom-plugins",
            "loading-custom-plugins-in-a-config-file",
            "using-argdown-in-your-application"
          ]
        }
      ],
      "/syntax/": [""]
    },
    nav: [
      { text: "Home", link: "/" },
      { text: "Guide", link: "/guide/" },
      { text: "Syntax", link: "/syntax/" },
      {
        text: "API",
        items: [
          { text: "Overview", link: "/api/" },
          { text: "@argdown/core", link: domain + "/argdown-core/index.html" },
          { text: "@argdown/node", link: domain + "/argdown-node/index.html" }
        ]
      },
      { text: "Changes", link: "/changes/" },
      { text: "Sandbox", link: domain + "/sandbox/" }
    ]
  }
};
