import { useWorkerClientStore } from '@/lib/stores/workerClient';
import MyTicket from './ui/MyTicket';
import { useEffect, useState } from 'react';
import { useNetworkStore } from '@/lib/stores/network';
import { cn } from '@/lib/helpers';
import PageButton from './ui/PageButton';
import { formatUnits } from '@/lib/unit';
import { Currency } from '@/constants/currency';
import { api } from '@/trpc/react';

interface ITicket {
  id: string;
  combination: number[];
  amount: number;
  claimed: boolean;
  funds: bigint | undefined;
}

export default function OwnedTickets({ roundId }: { roundId: number }) {
  const [currentTicket, setCurrentTicket] = useState<ITicket | undefined>(
    undefined
  );
  const workerStore = useWorkerClientStore();
  const [tickets, setTickets] = useState<
    {
      id: string;
      combination: number[];
      amount: number;
      claimed: boolean;
      funds: bigint | undefined;
    }[]
  >([]);
  const networkStore = useNetworkStore();
  const TICKETS_PER_PAGE = roundId != workerStore.lotteryRoundId ? 6 : 4;
  const [page, setPage] = useState<number>(1);
  const pagesAmount = Math.ceil(tickets.length / TICKETS_PER_PAGE);
  const renderTickets = tickets.slice(
    (page - 1) * TICKETS_PER_PAGE,
    page * TICKETS_PER_PAGE
  );

  const getRoundQuery = api.lotteryBackend.getRoundInfo.useQuery(
    {
      roundId: roundId,
    },
    {
      refetchInterval: 5000,
    }
  );

  useEffect(() => {
    if (!getRoundQuery.data) return;

    setTickets(
      getRoundQuery.data.tickets
        .filter(
          (x: { owner: string | undefined }) => x.owner == networkStore.address
        )
        .map(
          (
            x: { numbers: any; amount: any; funds: any; claimed: any },
            i: any
          ) => ({
            id: `${i}`,
            combination: x.numbers,
            amount: Number(x.amount),
            funds: x.funds,
            claimed: x.claimed,
          })
        )
    );
  }, [getRoundQuery.data]);

  return (
    <div
      className={cn('flex w-full flex-col', tickets.length == 0 && 'hidden')}
    >
      <div
        className={
          'mb-[1.33vw] flex flex-row items-center justify-start gap-[1vw]'
        }
      >
        <div className="text-[2.13vw]">Your tickets</div>
        {roundId != workerStore.lotteryRoundId &&
          tickets.length > TICKETS_PER_PAGE && (
            <div className={'flex flex-row gap-[0.5vw]'}>
              <button
                className={
                  'flex h-[1.82vw] w-[1.82vw] items-center justify-center rounded-[0.26vw] border border-foreground hover:opacity-80 disabled:opacity-60'
                }
                onClick={() => setPage((prevState) => prevState - 1)}
                disabled={page - 1 < 1}
              >
                <svg
                  width="0.729vw"
                  height="1.198vw"
                  viewBox="0 0 14 23"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M12.75 1.58301L2.75 11.583L12.75 21.583"
                    stroke="#F9F8F4"
                    strokeWidth="3"
                  />
                </svg>
              </button>

              <button
                className={
                  'flex h-[1.82vw] w-[1.82vw] items-center justify-center rounded-[0.26vw] border border-foreground hover:opacity-80 disabled:opacity-60'
                }
                onClick={() => setPage((prevState) => prevState + 1)}
                disabled={page + 1 > pagesAmount}
              >
                <svg
                  width="0.729vw"
                  height="1.198vw"
                  viewBox="0 0 14 23"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M1.25 1.58301L11.25 11.583L1.25 21.583"
                    stroke="#F9F8F4"
                    strokeWidth="3"
                  />
                </svg>
              </button>
            </div>
          )}
      </div>

      <div
        className={cn('flex w-full flex-row gap-[0.3vw]', {
          'flex-wrap gap-[1.042vw]': roundId != workerStore.lotteryRoundId,
        })}
      >
        {tickets.length > TICKETS_PER_PAGE &&
          page != 1 &&
          roundId == workerStore.lotteryRoundId && (
            <PageButton
              text={'Previous page'}
              symbol={'←'}
              onClick={() => {
                setPage((prevState) => prevState - 1);
                setCurrentTicket(undefined);
              }}
              disabled={page - 1 < 1}
            />
          )}
        {renderTickets.map((item, index) => (
          <MyTicket
            key={index}
            isOpen={
              roundId != workerStore.lotteryRoundId ||
              item.id == currentTicket?.id ||
              (currentTicket == undefined && index == 0)
            }
            combination={item.combination}
            amount={item.amount}
            index={
              page == 1
                ? index + 1
                : index + 1 + TICKETS_PER_PAGE * page - TICKETS_PER_PAGE
            }
            onClick={() => setCurrentTicket(item)}
            tags={
              item.funds
                ? [
                    `${Number(formatUnits(item.funds)).toFixed(2)} ${Currency.MINA} prize`,
                  ]
                : undefined
            }
            claimed={item.claimed}
            funds={item.funds}
            roundId={roundId}
          />
        ))}
        {tickets.length > TICKETS_PER_PAGE &&
          page + 1 <= pagesAmount &&
          roundId == workerStore.lotteryRoundId && (
            <PageButton
              text={'Next page'}
              symbol={'→'}
              onClick={() => {
                setPage((prevState) => prevState + 1);
                setCurrentTicket(undefined);
              }}
              disabled={page + 1 > pagesAmount}
            />
          )}
      </div>
    </div>
  );
}
