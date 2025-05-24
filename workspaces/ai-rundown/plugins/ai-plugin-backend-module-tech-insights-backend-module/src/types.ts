export interface GitHubPR {
  title: string;
  number: number;
  commits_url: string;
  html_url: string;
  merged_at: string;
}

export interface GitHubCommit {
  commit: {
    message: string;
    author: {
      name: string;
      date: string;
    };
  };
  sha: string;
  html_url: string;
}
