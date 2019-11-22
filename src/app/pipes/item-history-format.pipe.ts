import { Injectable, Pipe, PipeTransform } from '@angular/core';
import { ItemEntryLeague } from '../shared/api/item-entry';
import { ItemHistory } from '../shared/api/item-history';

@Pipe({
  name: 'itemHistoryFormat'
})
@Injectable({
  providedIn: 'root'
})
export class ItemHistoryFormatPipe implements PipeTransform {
  private readonly msInDay = 86400000;
  private readonly series = ['mean', 'median', 'mode', 'current', 'daily'];
  private readonly colors = ['#efc3ff', '#f6ffa1', '#99ffa0', '#aaff93', '#93ffe0'];

  transform(value: any[], args?: any): any[] {
    return null;
  }

  public formatHistory(il: ItemEntryLeague, h: ItemHistory[]): any {
    const dates = this.calculateDates(il, h);
    const output = [];

    for (const s of this.series) {
      const elem = {
        name: s,
        series: []
      };

      this.padHistory(il, h, dates, elem);
      output.push(elem);
    }

    return output;
  }

  // null values: https://github.com/swimlane/ngx-charts/issues/799
  private padHistory(il: ItemEntryLeague, h: ItemHistory[], dates: any, elem: { name: string, series: any[] }): void {
    // If entries are missing before the first entry, fill with "No data"
    if (dates.daysMissingStart) {
      const date = new Date(dates.startDate);

      for (let i = 0; i < dates.daysMissingStart; i++) {
        elem.series.push({
          name: this.incDate(date, i),
          value: 0,
          extra: {
            sequence: 0
          }
        });
      }
    }

    // Add actual history data
    for (let i = 0; i < h.length; i++) {
      const entry = h[i];

      elem.series.push({
        name: new Date(entry.time),
        value: entry[elem.name],
        extra: {
          sequence: 1
        }
      });

      // Check if there are any missing entries between the current one and the next one
      if (i + 1 < h.length) {
        const nextEntry = h[i + 1];

        // Get dates
        const currentDate = new Date(entry.time);
        const nextDate = new Date(nextEntry.time);

        // Get difference in days between entries
        const timeDiff = Math.abs(nextDate.getTime() - currentDate.getTime());
        const diffDays = Math.floor(timeDiff / (1000 * 3600 * 24)) - 1;

        // Fill missing days with "No data" (if any)
        for (let j = 0; j < diffDays; j++) {
          elem.series.push({
            name: this.incDate(currentDate, j + 1),
            value: 0,
            extra: {
              sequence: 2
            }
          });
        }
      }
    }

    // If entries are missing after the first entry, fill with "No data"
    if (dates.daysMissingEnd && dates.lastDate) {
      const date = new Date(dates.lastDate);
      date.setDate(date.getDate() + 1);

      for (let i = 0; i < dates.daysMissingEnd; i++) {
        elem.series.push({
          name: this.incDate(date, i),
          value: 0,
          extra: {
            sequence: 3
          }
        });
      }
    }

    // Add current values
    if (il.active) {
      elem.series.push({
        name: new Date(),
        value: il[elem.name],
        extra: {
          sequence: 4
        }
      });
    }

    // Bloat using 'null's the amount of days that should not have a tooltip.
    // Or in other words the number of days left in the league
    if (dates.startEmptyPadding) {
      const date = new Date(elem.series[elem.series.length - 1].name);
      date.setDate(date.getDate() + 1);

      for (let i = 0; i < dates.startEmptyPadding; i++) {
        elem.series.push({
          name: this.incDate(date, i),
          value: null,
          extra: {
            sequence: 5
          }
        });
      }
    }
  }

  private calculateDates(il: ItemEntryLeague, h: ItemHistory[]): any {
    const dates = {
      firstDate: null,
      lastDate: null,
      totalDays: null,
      elapsedDays: null,
      startDate: null,
      endDate: null,
      daysMissingStart: 0,
      daysMissingEnd: 0,
      startEmptyPadding: 0
    };

    // If there are any history entries for this league, find the first and last date
    if (h.length) {
      dates.firstDate = new Date(h[0].time);
      dates.lastDate = new Date(h[h.length - 1].time);
    }

    // League should always have a start date
    if (il.start) {
      dates.startDate = new Date(il.start);
    }

    // Permanent leagues don't have an end date
    if (il.end) {
      dates.endDate = new Date(il.end);
    }

    // Find duration for non-permanent leagues
    if (dates.startDate && dates.endDate) {
      dates.totalDays = Math.floor(Math.abs(dates.endDate.getTime() - dates.startDate.getTime()) / this.msInDay);

      if (il.active) {
        dates.elapsedDays = Math.floor(Math.abs(new Date().getTime() - dates.startDate.getTime()) / this.msInDay);
      } else {
        dates.elapsedDays = dates.totalDays;
      }
    }

    // Find how many days worth of data is missing from the league start
    if (il.id > 2) {
      if (dates.firstDate && dates.startDate) {
        dates.daysMissingStart = Math.floor(Math.abs(dates.firstDate.getTime() - dates.startDate.getTime()) / this.msInDay);
      }
    }

    // Find how many days worth of data is missing from the league end, if league has ended
    if (il.active) {
      // League is active, compare time of last entry to right now
      if (dates.lastDate) {
        dates.daysMissingEnd = Math.floor(Math.abs(new Date().getTime() - dates.lastDate.getTime()) / this.msInDay);
      }
    } else {
      // League has ended, compare time of last entry to time of league end
      if (dates.lastDate && dates.endDate) {
        dates.daysMissingEnd = Math.floor(Math.abs(dates.lastDate.getTime() - dates.endDate.getTime()) / this.msInDay);
      }
    }

    // Find number of ticks the graph should be padded with empty entries on the left
    if (il.id > 2) {
      if (dates.totalDays !== null && dates.elapsedDays !== null) {
        dates.startEmptyPadding = dates.totalDays - dates.elapsedDays;
      }
    } else {
      dates.startEmptyPadding = 120 - h.length;
    }

    return dates;
  }

  private formatDate(timeStamp: Date): string {
    const MONTH_NAMES = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ];

    const s = new Date(timeStamp);
    return `${s.getDate()} ${MONTH_NAMES[s.getMonth()]}`;
  }

  private incDate(date: Date, amount: number = 1) {
    const newDate = new Date(date.valueOf());
    newDate.setDate(newDate.getDate() + amount);
    return newDate;
  }
}
