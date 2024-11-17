import * as contentful from "contentful";
import { marked } from "marked";
import markedKatex from "marked-katex-extension";

export const contentfulClient = contentful.createClient({
    space: import.meta.env.CONTENTFUL_SPACE_ID,
    accessToken: import.meta.env.DEV ? import.meta.env.CONTENTFUL_PREVIEW_TOKEN : import.meta.env.CONTENTFUL_DELIVERY_TOKEN,
    host: import.meta.env.DEV ? "preview.contentful.com" : "cdn.contentful.com",
});

export interface InformationArticle {
    contentTypeId: "informationArticle",
    fields: {
        title: contentful.EntryFieldTypes.Text,
        directory: contentful.EntryFieldTypes.Text,
        articleContent: contentful.EntryFieldTypes.Text
    }
    sys: {
        id: contentful.EntryFieldTypes.Text
    }
}

export async function getArticleContent(articleId: string): Promise<string> {
    const entries = await contentfulClient.getEntries<InformationArticle>({
        content_type: "informationArticle",
        "sys.id": articleId
    });

    if (entries.items.length !== 1)
        return "";

    const markedKatexOptions = {
        throwOnError: false
    };

    marked.use(markedKatex(markedKatexOptions));
    marked.setOptions({
        gfm: true,
        breaks: true
    })
    return marked.parse(entries.items[0].fields.articleContent);
}

interface NavItem {
    fields: {
        title: string;
        directory: string;
    };
    sys: {
        id: string;
        type: string;
    };
}

export interface TreeNode {
    name: string;
    children: TreeNode[];
    isArticle: boolean;
    id?: string;
}

export async function getNavigationTree(): Promise<TreeNode[]> {
    const allInformationArticles = await contentfulClient.getEntries<InformationArticle>({
        content_type: "informationArticle",
        select: ["sys.id", "fields.title", "fields.directory"]
    });

    return sortTree(buildTree(allInformationArticles.items));
}

export function renderNode(node: TreeNode): string {
    if (node.isArticle) {
        return `<li><a href="/articles/${node.id}" data-astro-prefetch>${node.name}</a></li>`;
    }

    const sortedChildren = sortTree(node.children);
    const childrenHtml = sortedChildren.map(child => renderNode(child)).join('');

    return `
    <li>
        <details open>
            <summary>${node.name}</summary>
            <ul>
            ${childrenHtml}
            </ul>
        </details>
    </li>
    `;
}

function buildTree(items: NavItem[]): TreeNode[] {
    const root: TreeNode[] = [];

    items.forEach(item => {
        const paths = item.fields.directory.split("/");
        let currentLevel = root;

        // Navigate through directory structure
        paths.forEach((path, index) => {
            let existingNode = currentLevel.find(node => node.name === path && !node.isArticle);
            if (!existingNode) {
                existingNode = {
                    name: path,
                    children: [],
                    isArticle: false
                };
                currentLevel.push(existingNode);
            }

            currentLevel = existingNode.children;

            // If this is the last directory level, add the article
            if (index === paths.length - 1) {
                currentLevel.push({
                    name: item.fields.title,
                    children: [],
                    isArticle: true,
                    id: item.sys.id
                })
            }
        })
    })
    
    return root;
}

function sortTree(nodes: TreeNode[]): TreeNode[] {
    return nodes.sort((a, b) => {
        // Directories come before articles
        if (a.isArticle !== b.isArticle) {
            return a.isArticle ? 1 : -1;
        }
        // Alphabetical sorting within same type
        return a.name.localeCompare(b.name);
    })
}