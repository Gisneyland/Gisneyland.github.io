const assert = require('node:assert/strict');
const M = require('../assets/js/rich-content-model.js');

const md = M.markdownToHtml('# 標題\n\n**粗** [連結](https://a.tw)\n\n| a | b |\n|:-:|--:|\n| 1 | 2 |\n\n```mermaid\ngraph TD\nA-->B\n```\n\n> [!WARNING]\n> 小心');
assert.match(md, /<h1>標題<\/h1>/);
assert.match(md, /<strong>粗<\/strong> <a href="https:\/\/a.tw">連結<\/a>/);
assert.match(md, /<th style="text-align:center">a<\/th>/);
assert.match(md, /<pre class="rc-mermaid">graph TD\nA--&gt;B<\/pre>/);
assert.match(md, /rc-callout-warning/);
assert.match(M.markdownToHtml('<b>x</b> & <y'), /&amp; &lt;y/);

assert.equal(M.safeStyle('font-size:20px;position:fixed;color:#fff;background-image:url(x);color:red'), 'font-size:20px;color:#fff');
assert.equal(M.safeStyle("font-family:'Noto Sans TC','PingFang TC','Microsoft JhengHei',sans-serif"), "font-family:'noto sans tc','pingfang tc','microsoft jhenghei',sans-serif".replace(/'/g, "'"));
assert.equal(M.safeStyle('font-family:Comic Sans;font-size:900px;color:expression(1)'), '');
assert.equal(M.safeStyle('display:block;display:none'), 'display:block');

assert.equal(M.embedFor('https://youtu.be/dQw4w9WgXcQ').src, 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ');
assert.equal(M.embedFor('https://vimeo.com/123456789').src, 'https://player.vimeo.com/video/123456789');
assert.equal(M.embedFor('https://x.com/a.mp4').kind, 'video');
assert.equal(M.embedFor('http://youtu.be/dQw4w9WgXcQ'), null);
assert.equal(M.embedFor('javascript:alert(1)'), null);
assert.equal(M.siteEmbedUrl('http://a.com'), '');

const rows = [['a', 'b|c'], ['1', '2']];
const table = M.buildMarkdownTable(rows);
assert.deepEqual(M.parseMarkdownTable(table).rows, rows);
assert.deepEqual(M.parseHtmlTable(M.buildHtmlTable(rows)).rows, rows);
const text = `前\n\n${table}\n\n後`;
const found = M.locateTable(text, text.indexOf('1 |'));
assert.equal(text.slice(found.start, found.end), table);
assert.equal(M.locateTable('前\n\n後', 1), null);

const svg = M.chartSvg({ type: 'bar', title: '<b>', labels: ['<i>'], datasets: [{ label: 'x', data: [3] }] });
assert.ok(svg.startsWith('<svg') && !svg.includes('<b>') && !svg.includes('<i>'));
const titleText = svg.match(/<text[^>]*>[^<]*<\/text>/)[0];
assert.equal((titleText.match(/\bfont-size=/g) || []).length, 1);
assert.match(titleText, /font-size="15"/);
assert.ok(M.chartSvg({ type: 'pie', labels: ['a', 'b'], datasets: [{ data: [1, 1] }] }).includes('<path'));
assert.equal(M.chartSvg('{bad'), '');
assert.equal(M.chartSvg({ type: 'evil', labels: ['a'], datasets: [{ data: [1] }] }), '');

assert.equal(M.toPlainText('# 嗨\n\n**粗** [x](https://a.tw)', 'markdown'), '嗨\n\n粗 x');
assert.equal(M.toPlainText('<p>a &amp; b</p><script>x</script>', 'html'), 'a & b');
assert.equal(M.toPlainText('<b>原樣</b>', 'text'), '<b>原樣</b>');
assert.deepEqual(M.parseDiscussionUrls('https://a.tw/x\nhttp://bad.tw\njavascript:1\nhttps://a.tw/x'), ['https://a.tw/x']);
assert.equal(M.parseDiscussionUrls(Array(9).fill(0).map((_, i) => `https://a.tw/${i}`).join('\n')).length, 5);
assert.deepEqual(M.classifyDiscussion('https://mastodon.social/@gisney/111222333444'), { url: 'https://mastodon.social/@gisney/111222333444', host: 'mastodon.social', kind: 'mastodon', id: '111222333444' });
assert.equal(M.classifyDiscussion('https://x.com/a/status/1234567890').kind, 'twitter');
assert.equal(M.classifyDiscussion('https://www.facebook.com/a/posts/1').src.startsWith('https://www.facebook.com/plugins/post.php?href='), true);
assert.equal(M.classifyDiscussion('https://youtu.be/dQw4w9WgXcQ').kind, 'youtube');
assert.equal(M.classifyDiscussion('https://example.com/t').kind, 'link');
assert.equal(M.classifyDiscussion('http://example.com'), null);
console.log('rich-content-model ok');
