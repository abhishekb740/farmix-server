const express = require("express");
const app = express();
const { client } = require("./utils/Covalent/covalent");
const { config } = require("dotenv");
const cors = require("cors");
config();

app.use(
  cors({
    origin: [
      "http://localhost:3000",
      "https://farmix-web3bytes.vercel.app",
      "https://main.d1mk2y9g4ss2pn.amplifyapp.com",
      "https://farmix.online"
    ],
    methods: ["POST", "GET", "HEAD", "PUT", "DELETE", "PATCH"],
    credentials: true,
  })
);

app.use(express.json());
const PORT = process.env.PORT || 8081;

const calculateArraySimilarity = (array1, array2) => {
    if (!array1.length || !array2.length) return { similarity: 0, common: [] }; // Return 0 if either array is empty
    const set1 = new Set(array1);
    const set2 = new Set(array2);
    const intersection = new Set([...set1].filter((x) => set2.has(x)));
    const intersectionArray = Array.from(intersection);
    return {
        similarity:
            (intersectionArray.length / Math.max(set1.size, set2.size)) * 100,
        common: intersectionArray,
    };
};

// Calculate similarity between two arrays of objects as a percentage and collect common elements.
const calculateObjectArraySimilarity = (array1, array2, key) => {
    if (!array1.length || !array2.length) return { similarity: 0, common: [] }; // Return 0 if either array is empty

    const map1 = new Map(array1.map((item) => [item[key], item]));
    const map2 = new Map(array2.map((item) => [item[key], item]));

    const commonKeys = [...map1.keys()].filter((key) => map2.has(key));
    const common = commonKeys.map((key) => map1.get(key));

    return {
        similarity:
            (commonKeys.length / Math.max(array1.length, array2.length)) * 100,
        common: common,
    };
};

// Fetch all NFTs for a given address.
const getAllNFTsForAddress = async (address, client) => {
    const resp = await client.NftService.getNftsForAddress(
        "base-mainnet",
        address,
        { withUncached: true }
    );

    return resp.data?.items || [];
};

// Fetch all tokens for a given address.
const getAllTokensForAddress = async (address, client) => {
    const resp = await client.BalanceService.getTokenBalancesForWalletAddress(
        "base-mainnet",
        address
    );
    return resp.data?.items || [];
};

const getUserFollowingsForAddress = async (address) => {
    const query = `query {
      Farcaster: SocialFollowings(input: { filter: { identity: { _in: ["${address}"] }, dappName: { _eq: farcaster } }, blockchain: ALL }) {
        Following {
          followingAddress {
            socials(input: { filter: { dappName: { _eq: farcaster } } }) {
              profileName
              dappName
            }
          }
        }
      }
    }`;

    const response = await fetch("https://api.airstack.xyz/gql", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: process.env.AIRSTACK_API_KEY,
        },
        body: JSON.stringify({ query }),
    });

    const { data } = await response.json();
    return data.Farcaster.Following || [];
};

const getUserAddressFromFCUsername = async (username) => {
    const query = `query {
      Socials(input: { filter: { dappName: { _eq: farcaster }, profileName: { _eq: "${username}" } }, blockchain: ethereum }) {
        Social {
          connectedAddresses {
            address
            blockchain
            chainId
            timestamp
          }
        }
      }
    }`;

    const response = await fetch("https://api.airstack.xyz/gql", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: process.env.AIRSTACK_API_KEY,
        },
        body: JSON.stringify({ query }),
    });

    const { data } = await response.json();
    if (
        data.Socials &&
        data.Socials.Social.length > 0 &&
        data.Socials.Social[0].connectedAddresses.length > 0
    ) {
        return data.Socials.Social[0].connectedAddresses[0].address;
    }
    return null;
};

const getProfileDetails = async (username) => {
    const query = `query {
      Socials(input: { filter: { dappName: { _eq: farcaster }, profileName: { _eq: "${username}" } }, blockchain: ethereum }) {
        Social {
          profileDisplayName
          profileImage
        }
      }
    }`;

    const response = await fetch("https://api.airstack.xyz/gql", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: process.env.AIRSTACK_API_KEY,
        },
        body: JSON.stringify({ query }),
    });

    const { data } = await response.json();

    return data?.Socials?.Social[0] || null;
};

const getFollowingsProfileDetails = async (address) => {
    const followings = await getUserFollowingsForAddress(address);

    const profiles = await Promise.all(
        followings.map(async (following) => {
            const username = following.followingAddress.socials[0]?.profileName;
            if (username) {
                const profileDetails = await getProfileDetails(username);
                return {
                    username,
                    profileDetails,
                };
            }
            return null;
        })
    );

    return profiles
        .filter((profile) => profile !== null)
        .map((profile) => ({
            profileDisplayName: profile?.profileDetails?.profileDisplayName,
            username: profile?.username,
            profileImage: profile?.profileDetails?.profileImage,
        }));
};

const calculateSimilarity = async (primaryUsername, secondaryUsername) => {
    const primaryAddress = await getUserAddressFromFCUsername(primaryUsername);
    const secondaryAddress = await getUserAddressFromFCUsername(secondaryUsername);

  console.log(secondaryUsername, secondaryAddress);

  if (!primaryAddress) {
    throw new Error(
      `Primary username "${primaryUsername}" not found on Farcaster.`
    );
  }

  if (!secondaryAddress) {
    throw new Error(
      `Secondary username "${secondaryUsername}" not found on Farcaster.`
    );
  }

  console.log("We are here");

  const primaryNftData = await getAllNFTsForAddress(primaryAddress, client);
  const secondaryNftData = await getAllNFTsForAddress(secondaryAddress, client);

  const primaryTokenData = await getAllTokensForAddress(primaryAddress, client);
  const secondaryTokenData = await getAllTokensForAddress(
    secondaryAddress,
    client
  );

    const primaryFollowingData = await getFollowingsProfileDetails(
        primaryAddress
    );
    const secondaryFollowingData = await getFollowingsProfileDetails(
        secondaryAddress
    );

    const primaryNfts = primaryNftData.length
        ? primaryNftData
            .map((item) => item.nft_data?.[0]?.external_data?.image)
            .filter((image) => image)
        : [];
    const secondaryNfts = secondaryNftData.length
        ? secondaryNftData
            .map((item) => item.nft_data?.[0]?.external_data?.image)
            .filter((image) => image)
        : [];

    const primaryTokens = primaryTokenData.length
        ? primaryTokenData.map((item) => item.contract_ticker_symbol)
        : [];
    const secondaryTokens = secondaryTokenData.length
        ? secondaryTokenData.map((item) => item.contract_ticker_symbol)
        : [];

    const nftSimilarityResult = calculateArraySimilarity(
        primaryNfts,
        secondaryNfts
    );
    const tokenSimilarityResult = calculateArraySimilarity(
        primaryTokens,
        secondaryTokens
    );
    const followingSimilarityResult = calculateObjectArraySimilarity(
        primaryFollowingData,
        secondaryFollowingData,
        "username"
    );

  const similarities = [
    nftSimilarityResult.similarity,
    tokenSimilarityResult.similarity,
    followingSimilarityResult.similarity,
  ];

  const similarityScore =
    similarities.reduce((a, b) => a + b, 0) / similarities.length;

    return {
        similarityScore,
        commonNFTs: nftSimilarityResult.common,
        commonTokens: tokenSimilarityResult.common,
        commonFollowers: followingSimilarityResult.common,
    };
};

app.post("/calculateSimilarity", async (req, res) => {
    try {
        const { primaryUsername, secondaryUsername } = req.body;

        console.log(primaryUsername, secondaryUsername);

        const response = await calculateSimilarity(
            primaryUsername,
            secondaryUsername
        );

    console.log(response);
    return res.status(200).json(response);
  } catch (err) {
    console.log(err);
  }
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
