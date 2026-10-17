export type PixivItem = {
  rank: number;
  title: string;
  author: string;
  authorId: string;
  url: string;
  thumb: string;
  tags: string[];
};

export type PixivRankingData = {
  date: string;
  mode: string;
  illusts: PixivItem[];
};

// 仅供本地开发/未配置 Pixiv 凭据时的兜底占位，非真实榜单。
export const emptyRanking: PixivRankingData = {date: '', mode: 'day', illusts: []};
