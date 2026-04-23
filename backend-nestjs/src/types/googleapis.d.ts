declare module 'googleapis' {
  export namespace calendar_v3 {
    export interface Schema$Event {
      id?: string;
      summary?: string;
      description?: string;
      location?: string;
      start?: {
        dateTime?: string;
        date?: string;
        timeZone?: string;
      };
      end?: {
        dateTime?: string;
        date?: string;
        timeZone?: string;
      };
      attendees?: Array<{
        email?: string;
        displayName?: string;
      }>;
      conferenceData?: any;
      reminders?: {
        useDefault?: boolean;
        overrides?: Array<{ method?: string; minutes?: number }>;
      };
    }

    export interface Calendar {
      events: {
        insert(params: { calendarId: string; requestBody: Schema$Event; conferenceDataVersion?: number }): Promise<any>;
        list(params: { calendarId: string; timeMin?: string; timeMax?: string; singleEvents?: boolean; orderBy?: string }): Promise<any>;
        patch(params: { calendarId: string; eventId: string; requestBody: Schema$Event }): Promise<any>;
        delete(params: { calendarId: string; eventId: string }): Promise<any>;
      };
    }
  }

  export namespace drive_v3 {
    export interface Schema$File {
      id?: string;
      name?: string;
      mimeType?: string;
      size?: string;
      webViewLink?: string;
      thumbnailLink?: string;
      createdTime?: string;
      modifiedTime?: string;
      parents?: string[];
    }

    export interface Drive {
      files: {
        create(params: { requestBody: Schema$File; media?: any; fields?: string }): Promise<any>;
        list(params?: { q?: string; pageSize?: number; fields?: string; orderBy?: string }): Promise<any>;
        get(params: { fileId: string; fields?: string; alt?: string }, options?: any): Promise<any>;
      };
    }
  }

  export const google: {
    calendar(options: { version: string; auth: any }): calendar_v3.Calendar;
    drive(options: { version: string; auth: any }): drive_v3.Drive;
  };
}