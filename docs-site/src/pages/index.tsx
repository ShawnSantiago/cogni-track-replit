import Layout from '@theme/Layout'
import Heading from '@theme/Heading'
import Link from '@docusaurus/Link'
import useDocusaurusContext from '@docusaurus/useDocusaurusContext'

export default function Home(): JSX.Element {
  const {siteConfig} = useDocusaurusContext()

  return (
    <Layout description="CogniTrack documentation hub">
      <header className="hero heroBanner">
        <div className="container">
          <Heading as="h1" className="hero__title">
            {siteConfig.title}
          </Heading>
          <p className="hero__subtitle">{siteConfig.tagline}</p>
          <div className="buttons">
            <Link className="button button--primary" to="/docs">
              Explore the docs
            </Link>
            <Link className="button button--secondary button--outline" to="/blog">
              View updates
            </Link>
          </div>
        </div>
      </header>
      <main className="container margin-vert--lg">
        <section className="row">
          <div className="col col--4">
            <h2>Aligned with the app</h2>
            <p>
              The documentation adopts the same design tokens used in the Next.js application for a cohesive brand experience.
            </p>
          </div>
          <div className="col col--4">
            <h2>Built for iteration</h2>
            <p>
              Edit Markdown, preview locally with <code>npm run docs</code>, and ship updates through the existing CI pipelines.
            </p>
          </div>
          <div className="col col--4">
            <h2>Ready for scale</h2>
            <p>
              As we progress through the adoption roadmap, the site will evolve with versioning, search, and analytics.
            </p>
          </div>
        </section>
      </main>
    </Layout>
  )
}
