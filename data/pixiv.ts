export type PixivItem = {
  rank: number;
  id: number;
  title: string;
  author: string;
  authorId: string;
  thumb: string;
  tags: string[];
};

export type PixivRankingData = {
  date: string;
  mode: string;
  illusts: PixivItem[];
  nextOffset: number | null;
};

// 仅供本地开发/未配置 Pixiv 凭据时的兜底占位，非真实榜单。
export const emptyRanking: PixivRankingData = {date: '', mode: 'day', illusts: [], nextOffset: null};
