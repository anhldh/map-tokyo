import TrainTimetable, {
  type TrainTimetableParams,
  type TrainTimetableRefs,
} from "./trainTimetable";


export default class TrainTimeTables {
  array: TrainTimetable[];
  trainLookup: Map<string, TrainTimetable | TrainTimetable[]>;
  railwayDirectionLookup: Map<string, TrainTimetable[]>;

  constructor(data: TrainTimetableParams[], refs: TrainTimetableRefs) {
    const lookup = new Map<string, TrainTimetable>();

    this.array = [];
    this.trainLookup = new Map();
    this.railwayDirectionLookup = new Map();

    for (const item of data) {
      const timetable = new TrainTimetable(item, refs);

      this.add(timetable);
      lookup.set(timetable.id, timetable);
    }

    for (const item of data) {
      if (item.pt || item.nt) {
        const timetable = lookup.get(item.id)!;

        timetable.update(item, {
          ...refs,
          timetables:
            lookup as unknown as import("./types").Registry<TrainTimetable>,
        });
      }
    }
  }

  add(timetable: TrainTimetable): void {
    const { array, trainLookup, railwayDirectionLookup } = this,
      trainId = timetable.t,
      timetablesByTrain = trainLookup.get(trainId),
      railwayDirectionId = `${timetable.r.id}:${timetable.d.id}`,
      timetablesByDirection = railwayDirectionLookup.get(railwayDirectionId);

    array.push(timetable);

    if (Array.isArray(timetablesByTrain)) {
      timetablesByTrain.push(timetable);
    } else {
      trainLookup.set(
        trainId,
        timetablesByTrain ? [timetablesByTrain, timetable] : timetable,
      );
    }

    if (timetablesByDirection) {
      timetablesByDirection.push(timetable);
    } else {
      railwayDirectionLookup.set(railwayDirectionId, [timetable]);
    }
  }

  getByTrainId(trainId: string): TrainTimetable[] {
    const timetables = this.trainLookup.get(trainId);

    return Array.isArray(timetables)
      ? timetables
      : timetables
        ? [timetables]
        : [];
  }

  getByDirectionId(railwayId: string, directionId: string): TrainTimetable[] {
    return this.railwayDirectionLookup.get(`${railwayId}:${directionId}`) || [];
  }

  getAll(): TrainTimetable[] {
    return this.array;
  }

  getConnectingTrainIds(trainId: string): string[] {
    const ids = new Set<string>();

    for (const timetable of this.getByTrainId(trainId)) {
      for (const id of timetable.getConnectingTrainIds()) {
        ids.add(id);
      }
    }
    return Array.from(ids);
  }

  clear(): void {
    this.array = [];
    this.trainLookup = new Map();
    this.railwayDirectionLookup = new Map();
  }
}
