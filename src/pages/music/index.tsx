import React from "react";

import { PageMetadata } from "@docusaurus/theme-common";
import Layout from "@theme/Layout";
import Admonition from '@theme/Admonition';

function Page() {
	return (
		<div>
			<h1>音乐</h1>
				<Admonition type="info">
					<p>本站音乐为本人自购或来自互联网。</p>
				</Admonition>
					
			<p>
			　　于我而言，音乐是永远的避风港。戴上耳机，就能抛开周遭的嘈杂，进入一个只有自己的小世界。屏幕前的你又喜欢什么样的音乐呢？
			</p>
			<h4>　　以下是我个人收藏的音乐，以 ACG 为主，希望你也能喜欢～ </h4>
			<div className="markdown" style={{ marginBottom: "15px" }}>
				<h2>歌单切换</h2>
			</div>
			<div id="aplayer_list_parent">
				<div id="aplayer_list"></div>
			</div>
			<div className="markdown" style={{ marginBottom: "15px" }}>
				<h2>自定义播放列表</h2>
			</div>
			{" "}
			<Admonition type="tip">
					<p>
						播放列表内歌曲的顺序为选择歌曲时的顺序。关于搜索：要回到进行搜索之前的歌单，可以手动清空搜索框，或者按
						Delete 键清空搜索框，然后点击其他位置。
					</p>
			</Admonition>
			<div id="aplayer_list-current-list">
				<button id="ap_list0" className="sytle-button-current-list">
					&lt;当前播放列表&gt;
				</button>
			</div>
			<div id="ap_list_button">
				<div id="ap_list_button_sub">
					<button id="ap_list_remove">清空播放列表</button>
					<button id="ap_list_select_all">全选</button>
					<button id="ap_list_random_select">随机选几首</button>
				</div>
			</div>
			<div id="aplayer_list_active"></div>
			<div className="markdown" style={{ marginBottom: "15px" }}>
				<h2>音乐播放器</h2>
			</div>
			{" "}
			<Admonition type="info">
					<p>
						音质默认为 HQ，即 320K 的
						MP3，因为使用无损音质时播放的流畅度受网络环境影响很大。歌曲文件未加载完全时无法调节进度条，无损音质下大概率无法调节进度条。
						播放器使用
						<a
							href="https://github.com/DIYgod/APlayer"
							target="_blank"
							rel="noopener noreferrer"
						>
							APlayer
						</a>
						，本页的播放器在播放中切换到别的页面时，需要通过
						<font color="#dd0000">播放左下角迷你播放器里面的音乐</font>来暂停。
					</p>
			</Admonition>
			<div id="aplayer_ctr">
				<div id="aplayer_qua">
					<button id="ap_qua1" className="sytle-qua-button">
						SQ & Hires
					</button>
					<button id="ap_qua2" className="sytle-qua-button">
						HQ
					</button>
				</div>
			</div>
			<div id="aplayer0">
				<div id="aplayer0-button">
					<button id="ap_load" className="sytle-ap-button">
						点击加载播放器
					</button>
				</div>
			</div>
			<div className="markdown" style={{ marginBottom: "15px" }}>
				<h2>MV</h2>
			</div>
			<div id="mv_player_div" style={{ marginBottom: "50px" }}></div>
		</div>
	);
}

export default function music() {
	const title = "音乐";
	const description = "Yusenの音乐库";

	return (
		<>
			<PageMetadata title={title} description={description} />
			<Layout>
				<div className="container margin-top--md">
					<div>
						<main className="col col--11" style={{ display : "flex"}}>
							<Page />
						</main>
					</div>
				</div>
			</Layout>
		</>
	);
}
