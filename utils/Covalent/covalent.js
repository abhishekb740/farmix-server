import { CovalentClient } from "@covalenthq/client-sdk";

export const client = new CovalentClient(`${process.env.COVALENT_API_KEY}`);