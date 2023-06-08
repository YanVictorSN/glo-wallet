import Image from "next/image";
import { useState } from "react";

import { getImpactItems, isLiftPersonOutOfPovertyImpactItem } from "@/utils";

type Props = {
  yearlyYield: number;
  glo: number;
};

export default function DetailedEnoughToBuy({ yearlyYield, glo }: Props) {
  const [flipped, setFlipped] = useState<boolean>(false);

  let yearlyImpactItems = getImpactItems(yearlyYield).slice(0, 2);
  const enoughToLiftPersonOutOfPoverty =
    yearlyImpactItems.length > 0 &&
    isLiftPersonOutOfPovertyImpactItem(yearlyImpactItems[0]);

  const getFormattedImpactItems = (): JSX.Element => {
    if (yearlyImpactItems.length === 0) {
      return <></>;
    }

    if (enoughToLiftPersonOutOfPoverty) {
      yearlyImpactItems = yearlyImpactItems.slice(0, 1);
    }

    const getOrDivider = (): JSX.Element => {
      return (
        <div className="relative flex items-center">
          <div className="flex-grow border border-pine-100"></div>
          <span className="flex-shrink mx-2 text-pine-700 text-sm">or</span>
          <div className="flex-grow border border-pine-100"></div>
        </div>
      );
    };

    return (
      <div className="flex flex-col space-y-4">
        {yearlyImpactItems.map((impactItem, idx, arr) => {
          return (
            <div className="flex flex-col space-y-4" key={idx}>
              <div className="flex flex-row">
                <div className="mr-2 text-2xl leading-6">
                  {impactItem.emoji}
                </div>
                <div className="mr-2 text-xs leading-6">&#10005;</div>
                <div className="mr-2">{impactItem.count}</div>
                <div>
                  {impactItem.description}
                  {!isLiftPersonOutOfPovertyImpactItem(impactItem) && (
                    <span className="text-pine-700"> / year</span>
                  )}
                </div>
              </div>
              {idx !== arr.length - 1 && getOrDivider()}
            </div>
          );
        })}
      </div>
    );
  };

  if (flipped) {
    return (
      <div className="flex flex-col bg-white rounded-[20px] p-6 space-y-6">
        <div className="flex flex-row justify-between">
          <div className="font-semibold text-xl">
            WHAT DOES $0 - ${yearlyYield} MEAN?
          </div>
          <div
            className="bg-pine-900/[0.1] h-8 w-8 px-2.5 py-2.5 rounded-full cursor-pointer"
            onClick={() => setFlipped(false)}
          >
            <Image width={12} height={12} src="/x.svg" alt="x-icon" />
          </div>
        </div>
        <div className="flex flex-col space-y-4">
          <div>
            We fund basic incomes with the money we make from the reserves
            backing the Glo Dollar.
          </div>
          <div>
            How much money we make per ${glo} of Glo Dollar adoption depends.
            During Bootstrap Phase, it&apos;s closer to the lower end of the
            spectrum ($0). At scale, we aim to move towards the higher end of
            the spectrum (${yearlyYield}).
          </div>
        </div>
        <div className="flex flex-col space-y-4">
          <div className="bg-pine-900/[0.1] rounded-full h-12">
            <a
              className="block text-center leading-[3rem] font-semibold"
              href="https://docs.google.com/spreadsheets/d/1ft-DnIJ58M__xHBr0tl3Cux2SNUwwvhixE2wq04Z8CY/edit#gid=434329432"
              target="_blank"
              rel="noopener noreferrer"
            >
              How we calculate
            </a>
          </div>
          <div className="bg-pine-900/[0.1] rounded-full h-12">
            <a
              className="block text-center leading-[3rem] font-semibold"
              href="https://www.glodollar.org/articles/givedirectly"
              target="_blank"
              rel="noopener noreferrer"
            >
              How cash transfers work
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col bg-white rounded-[20px] space-y-6">
      <div className="flex flex-row justify-between p-6 pb-0">
        <div className="text-xl font-semibold">
          Enough to {enoughToLiftPersonOutOfPoverty ? "lift" : "buy"}:
        </div>
        <div
          className="bg-pine-900/[0.1] h-8 w-8 px-2 py-2 rounded-full cursor-pointer"
          onClick={() => setFlipped(true)}
        >
          <Image width={16} height={16} src="/info.svg" alt="info-icon" />
        </div>
      </div>
      <div className="px-6">{getFormattedImpactItems()}</div>
      <div className="px-6 pt-2">
        <div className="text-center text-pine-700">
          Recipients get cash, so they can buy what&apos;s most useful for their
          family
        </div>
      </div>
    </div>
  );
}
