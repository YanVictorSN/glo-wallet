import * as StellarSdk from "@stellar/stellar-sdk";
import { kv } from "@vercel/kv";
import { Chain } from "@wagmi/core";
import {
  celo,
  celoAlfajores,
  goerli,
  mainnet,
  polygon,
  polygonMumbai,
  optimism,
  optimismSepolia,
  arbitrum,
  arbitrumSepolia,
  base,
  baseSepolia,
} from "@wagmi/core/chains";
import axios from "axios";
import { BigNumber } from "ethers";

import { TokenTransfer } from "@/lib/blockscout-explorer";
import { horizonUrl, isProd } from "@/lib/utils";
import { getBalance, getBlockNumber } from "@/utils";

export const getBalances = async (address: string, onDate?: Date) => {
  if (!isProd()) {
    return {
      totalBalance: 0,
    };
  }

  let balance = 0;
  let [
    polygonBalance,
    ethereumBalance,
    celoBalance,
    optimismBalance,
    arbitrumBalance,
    stellarBalance,
    baseBalance,
  ] = [
    BigNumber.from("0"),
    BigNumber.from("0"),
    BigNumber.from("0"),
    BigNumber.from("0"),
    BigNumber.from("0"),
    BigNumber.from("0"),
    BigNumber.from("0"),
  ];

  if (address.slice(0, 4).includes("0x")) {
    [
      polygonBalance,
      ethereumBalance,
      celoBalance,
      optimismBalance,
      arbitrumBalance,
      baseBalance,
    ] = await Promise.all([
      getChainBalance(address, isProd() ? polygon : polygonMumbai, onDate),
      getChainBalance(address, isProd() ? mainnet : goerli, onDate),
      getChainBalance(address, isProd() ? celo : celoAlfajores, onDate),
      getChainBalance(address, isProd() ? optimism : optimismSepolia, onDate),
      getChainBalance(address, isProd() ? arbitrum : arbitrumSepolia, onDate),
      getChainBalance(address, isProd() ? base : baseSepolia, onDate),
    ]);
    const decimals = BigInt(10 ** 18);
    balance = polygonBalance
      .add(ethereumBalance)
      .add(celoBalance)
      .add(arbitrumBalance)
      .add(optimismBalance)
      .add(baseBalance)
      .div(decimals)
      .toNumber();
  } else {
    stellarBalance = await getStellarBalance(address, onDate);
    const decimals = BigInt(10 ** 7);
    balance = stellarBalance.div(decimals).toNumber();
  }

  return {
    totalBalance: balance,
    polygonBalance,
    ethereumBalance,
    celoBalance,
    optimismBalance,
    arbitrumBalance,
    baseBalance,
    stellarBalance,
  };
};

async function getChainBalance(
  address: string,
  chain: Chain,
  onDate?: Date
): Promise<BigNumber> {
  const chainName = chain.name.toLowerCase();
  const utcDate = onDate ? onDate.toJSON().substring(0, 10) : "";

  const cacheKey = `balance-${address}-${utcDate}`;
  const cacheValue = await kv.hget(cacheKey, chainName);

  let balance = BigNumber.from(0);

  try {
    if (!cacheValue) {
      if (onDate) {
        const blockNumber = await getChainBlockNumber(onDate, chain);
        balance = await getBalance(address as string, chain.id, blockNumber);
      } else {
        balance = await getBalance(address as string, chain.id);
      }

      await kv.hset(cacheKey, {
        [chainName]: balance.toString(),
      });
      await kv.expire(cacheKey, 60 * 60 * 24);
    } else {
      balance = BigNumber.from(cacheValue.toString());
    }
  } catch (_err) {
    console.log(`Can't fetch balance for ${address}`);
  }
  return balance;
}

async function getStellarBalance(
  address: string,
  onDate?: Date
): Promise<BigNumber> {
  const cacheKey = `balance-${address}`;
  const cacheValue = await kv.hget(cacheKey, "Stellar");

  if (cacheValue) {
    return BigNumber.from(cacheValue);
  }

  try {
    const apiUrl = `${horizonUrl}/accounts/${address}`;
    const res = await axios.get(apiUrl, {
      headers: { Accept: "application/json" },
    });
    let stellarBalanceValue = res.data.balances.reduce(
      (acc: any, cur: any) =>
        cur.asset_code == "USDGLO" ? (acc += parseFloat(cur.balance)) : acc,
      0
    );

    if (onDate) {
      const sum = await calculateStellarBalance(address, onDate);
      stellarBalanceValue += sum;
    }

    const balance = BigNumber.from(`${stellarBalanceValue}`.replace(".", ""));

    await kv.hset(cacheKey, {
      chainName: balance.toString(),
    });
    await kv.expire(cacheKey, 60 * 60 * 24);

    return balance;
  } catch (err) {
    console.error(
      `Something went wrong getting the stellar balances for: ${address}`
    );
    return BigNumber.from(0);
  }
}

export const getStellarTxs = async (
  address: string,
  from: Date,
  to = new Date()
) => {
  const records = [];
  let url = `${horizonUrl}/accounts/${address}/transactions?order=desc&limit=200`;
  while (true) {
    try {
      const res2 = await axios.get(url, {
        headers: { Accept: "application/json" },
      });

      const data = res2.data["_embedded"]["records"];
      records.push(...data);

      const firstDate = records[records.length - 1]["created_at"];

      if (data.length < 200 || new Date(firstDate) < from) {
        break;
      }
      url = res2.data["_links"]["next"]["href"];
    } catch (err) {
      console.error(
        `Something went wrong getting the stellar transactions for: ${address}`
      );
      return [];
    }
  }

  return records
    .filter(
      (x) => new Date(x["created_at"]) >= from && new Date(x["created_at"]) < to
    )
    .map(
      (record) =>
        StellarSdk.TransactionBuilder.fromXDR(
          record.envelope_xdr,
          isProd() ? StellarSdk.Networks.PUBLIC : StellarSdk.Networks.TESTNET
        ) as StellarSdk.Transaction
    );
};

const calculateStellarBalance = async (address: string, onDate: Date) => {
  let sum = 0;
  const txs = await getStellarTxs(address, onDate);
  for (const tx of txs) {
    for (const op of tx.operations) {
      if (op.type === "payment" && op.asset.code === "USDGLO") {
        const incoming = op.destination === address;
        sum += parseFloat(op.amount) * (incoming ? +1 : -1);
      }
    }
  }
  return sum;
};

export async function getChainBlockNumber(
  date: Date,
  chain: Chain
): Promise<number> {
  const chainName = chain.name.toLowerCase();
  const utcDate = date ? date.toJSON().substring(0, 10) : "";

  const cacheKey = `blocknumber-${utcDate}`;
  const cacheValue: string | null = await kv.hget(cacheKey, chainName);

  let blockNumber;

  if (!cacheValue) {
    blockNumber = await getBlockNumber(date, chain.id);

    await kv.hset(cacheKey, {
      [chainName]: blockNumber.toString(),
    });
    await kv.expire(cacheKey, 60 * 60 * 24 * 183);
  } else {
    blockNumber = parseInt(cacheValue);
  }
  return blockNumber;
}

export async function getAverageBalance(
  walletAddress: string,
  startDate: Date,
  endDate: Date,
  endBalance: BigNumber,
  transactions: TokenTransfer[]
): Promise<BigNumber> {
  const milisecondsInMonthString = endDate.valueOf() - startDate.valueOf();
  const milisecondsInMonth = BigNumber.from(
    milisecondsInMonthString.toString()
  );
  let totalBalance = BigNumber.from("0");
  let currentDate = endDate;
  let currentBalance = endBalance;

  transactions.forEach((transaction) => {
    const txDate = new Date(parseInt(transaction["timeStamp"]) * 1000);
    const balanceTime = BigNumber.from(
      (currentDate.valueOf() - txDate.valueOf()).toString()
    );
    const weightedBalance = currentBalance.mul(balanceTime);
    totalBalance = totalBalance.add(weightedBalance);
    currentDate = txDate;
    const transactionDelta = BigNumber.from(transaction["value"]);
    currentBalance =
      transaction["from"].toLowerCase() === walletAddress.toLowerCase()
        ? currentBalance.add(transactionDelta)
        : currentBalance.sub(transactionDelta);
  });

  const balanceTime = currentDate.valueOf() - startDate.valueOf();
  const weightedBalance = currentBalance.mul(BigNumber.from(balanceTime));
  totalBalance = totalBalance.add(weightedBalance);

  const decimals = BigInt(10 ** 18);
  const averageBalance = totalBalance.div(milisecondsInMonth);

  return averageBalance;
}
