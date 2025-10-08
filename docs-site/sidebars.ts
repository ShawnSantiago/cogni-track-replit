import type {SidebarsConfig} from '@docusaurus/plugin-content-docs'

const sidebars: SidebarsConfig = {
  guides: [
    'intro',
    {
      type: 'category',
      label: 'Product',
      items: ['product/prd', 'product/docusaurus-adoption-plan'],
    },
    {
      type: 'category',
      label: 'Architecture',
      items: ['architecture/overview', 'architecture/openai-admin-migration-design'],
    },
    {
      type: 'category',
      label: 'Operations',
      items: [
        {
          type: 'category',
          label: 'Runbooks',
          items: [
            'operations/runbooks',
            'operations/deployment-checklist',
            'operations/cost-anomaly-investigation',
            'operations/integrations-monitoring',
          ],
        },
        {
          type: 'category',
          label: 'Security & Compliance',
          items: ['operations/security/openai-admin-security-controls'],
        },
      ],
    },
    {
      type: 'category',
      label: 'Contributing',
      items: ['contributing/documentation'],
    },
  ],
}

export default sidebars
