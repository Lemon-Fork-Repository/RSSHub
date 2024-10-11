export type Asset = {
    eid: string;
    pid: string;
    title: string;
    enclosure: {
        url: string;
    };
    duration: number;
    pubDate: string;
    shownotes: string;
    podcast: {
        pid: string;
        title: string;
        author: string;
        description: string;
        image: {
            smallPicUrl: string;
        };
    };
    isPrivateMedia: boolean;
    isOwned: boolean;
    trial: {
        segment: string;
    };
};
