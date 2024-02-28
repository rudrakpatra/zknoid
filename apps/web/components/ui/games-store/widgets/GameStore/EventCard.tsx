import {
  useEventTimer,
  ZkNoidEvent,
  ZkNoidEventType,
} from '@/lib/platform/game_events';
import Image from 'next/image';
import eventBoxImg from '@/public/image/section2/event-box.svg';

export const EventCard = ({
  headText,
  description,
  event,
}: {
  headText: string;
  description: string;
  event: ZkNoidEvent;
}) => {
  const eventCounter = useEventTimer(event);
  const time = `${eventCounter.startsIn.days}d ${
    eventCounter.startsIn.hours
  }h:${eventCounter.startsIn.minutes}m:${Math.trunc(
    eventCounter.startsIn.seconds!
  )}s`;
  return (
    <div className="relative flex flex-col border-left-accent">
      <Image src={eventBoxImg} alt="" className="-z-10 w-full" />
      <div className="absolute left-0 top-0 flex h-full w-full flex-col p-5">
        <div className="text-headline-2 pb-2">{headText}</div>
        <div className="font-plexsans max-w-[462px] text-main">
          {description}
        </div>
        <div className="flex-grow"></div>
        <div className="max-w-[462px] text-big-uppercase">
          {eventCounter.type == ZkNoidEventType.UPCOMING_EVENTS && (
            <>START IN {time}</>
          )}
          {eventCounter.type == ZkNoidEventType.CURRENT_EVENTS && (
            <>END IN {time}</>
          )}
        </div>
      </div>
    </div>
  );
};
