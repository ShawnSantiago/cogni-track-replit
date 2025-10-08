import type {Config} from '@docusaurus/types'
import {themes as prismThemes} from 'prism-react-renderer'

const config: Config = {
  title: 'CogniTrack Docs',
  tagline: 'Centralized knowledge for the CogniTrack platform',
  favicon: 'img/logo.svg',

  url: process.env.DOCS_URL || 'https://cogni-track-docs.vercel.app',
  baseUrl: '/',

  organizationName: 'cogni-track',
  projectName: 'cogni-track-docs',

  onBrokenLinks: 'throw',
  onBrokenMarkdownLinks: 'warn',

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          editUrl: 'https://github.com/cogni-track/cogni-track-replit/edit/main/docs-site/',
          routeBasePath: 'docs',
        },
        blog: {
          showReadingTime: true,
          blogTitle: 'CogniTrack Updates',
          blogDescription: 'Release notes and change logs for the CogniTrack documentation site.',
        },
        theme: {
          customCss: './src/css/custom.css',
        },
      },
    ],
  ],

  themeConfig: {
    image: 'img/social-card.png',
    navbar: {
      title: 'CogniTrack',
      logo: {
        alt: 'CogniTrack Logo',
        src: 'img/logo.svg',
      },
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'guides',
          position: 'left',
          label: 'Guides',
        },
        {to: '/blog', label: 'Updates', position: 'left'},
        {
          href: 'https://github.com/cogni-track/cogni-track-replit',
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Docs',
          items: [
            {label: 'Getting Started', to: '/docs'},
            {label: 'Architecture Overview', to: '/docs/architecture/overview'},
          ],
        },
        {
          title: 'Community',
          items: [
            {label: 'GitHub Issues', href: 'https://github.com/cogni-track/cogni-track-replit/issues'},
          ],
        },
        {
          title: 'More',
          items: [
            {label: 'Changelog', to: '/blog'},
            {label: 'Project README', href: 'https://github.com/cogni-track/cogni-track-replit#readme'},
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} CogniTrack. Built with Docusaurus.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
    },
    colorMode: {
      defaultMode: 'light',
      disableSwitch: false,
      respectPrefersColorScheme: true,
    },
  },
}

export default config
