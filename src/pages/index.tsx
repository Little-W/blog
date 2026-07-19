import Link from '@docusaurus/Link';
import Layout from '@theme/Layout';

const entries = [
  {title: '音乐', text: '音乐库与 MV', to: '/music/'},
  {title: '学习笔记', text: '数字设计与日语', to: '/docs/notes/'},
  {title: '其他文章', text: '杂项与系统说明', to: '/docs/etc/'},
  {title: '网址导航', text: '常用站点', to: '/website/'},
];

export default function Home(): JSX.Element {
  return (
    <Layout title="Yusen">
      <main className="container margin-vert--lg">
        <section className="margin-bottom--lg">
          <h1>Yusen</h1>
          <div className="row">
            {entries.map((entry) => (
              <div className="col col--3 margin-bottom--md" key={entry.to}>
                <Link className="card padding--lg" to={entry.to}>
                  <h2>{entry.title}</h2>
                  <p>{entry.text}</p>
                </Link>
              </div>
            ))}
          </div>
        </section>
      </main>
    </Layout>
  );
}
