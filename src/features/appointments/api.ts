"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { track } from "@/shared/lib/analytics";
import { api, unwrap, unwrapEmpty, type Schemas } from "@/shared/lib/api/client";

/** The appointment engine (GLOBAL_PROMPT 10.1): booking rules, calendars, slots, bookings, the funnel. */
export const apptKeys = {
  all: ["appointments"] as const,
  booking: (clientId: string) => ["appointments", "booking", clientId] as const,
  slots: (leadId: string) => ["appointments", "slots", leadId] as const,
  lead: (leadId: string) => ["appointments", "lead", leadId] as const,
  list: (q: ListQuery) => ["appointments", "list", q] as const,
  funnel: (q: FunnelQuery) => ["appointments", "funnel", q] as const,
  calendar: ["appointments", "calendar"] as const,
  publicBooking: (token: string) => ["appointments", "public-book", token] as const,
  publicAppt: (token: string) => ["appointments", "public-appt", token] as const,
  publicSlots: (token: string) => ["appointments", "public-slots", token] as const,
};

export type Booking = Schemas["Booking"];
export type BookingInput = Schemas["BookingInput"];
export type BookingHours = Schemas["BookingHours"];
export type Appointment = Schemas["Appointment"];
export type Slot = Schemas["Slot"];
export type Funnel = Schemas["AppointmentFunnel"];
export type FunnelRow = Schemas["AppointmentFunnelRow"];
export type CalendarStatus = Schemas["CalendarStatus"];
export type ListQuery = { from?: string; to?: string; client_id?: string; mine?: boolean };
export type FunnelQuery = { from?: string; to?: string; client_id?: string };

export const WEEKDAYS = ["sat", "sun", "mon", "tue", "wed", "thu", "fri"] as const;
export const STATUSES = ["booked", "confirmed", "cancelled", "attended", "no_show"] as const;

export function useBooking(clientId: string) {
  return useQuery({
    queryKey: apptKeys.booking(clientId),
    queryFn: () => unwrap(api.GET("/v1/clients/{clientId}/booking", { params: { path: { clientId } } })),
  });
}

export function useSaveBooking(clientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: BookingInput) =>
      unwrap(api.PUT("/v1/clients/{clientId}/booking", { params: { path: { clientId } }, body })),
    meta: { silent: true },
    onSuccess: (b) => {
      track("booking.saved", { enabled: b.enabled });
      qc.setQueryData(apptKeys.booking(clientId), b);
    },
  });
}

export function useAddResource(clientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; kind: "room" | "vehicle" | "equipment" | "other" }) =>
      unwrap(api.POST("/v1/clients/{clientId}/booking/resources", { params: { path: { clientId } }, body })),
    onSuccess: () => void qc.invalidateQueries({ queryKey: apptKeys.booking(clientId) }),
  });
}

export function useToggleResource(clientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      unwrap(
        api.PATCH("/v1/booking/resources/{resourceId}", { params: { path: { resourceId: id } }, body: { active } }),
      ),
    onSuccess: () => void qc.invalidateQueries({ queryKey: apptKeys.booking(clientId) }),
  });
}

export function useLeadSlots(leadId: string, enabled: boolean) {
  return useQuery({
    queryKey: apptKeys.slots(leadId),
    queryFn: () => unwrap(api.GET("/v1/leads/{leadId}/booking/slots", { params: { path: { leadId } } })),
    enabled,
  });
}

export function useLeadAppointments(leadId: string) {
  return useQuery({
    queryKey: apptKeys.lead(leadId),
    queryFn: () => unwrap(api.GET("/v1/leads/{leadId}/appointments", { params: { path: { leadId } } })),
  });
}

function useInvalidate(leadId?: string) {
  const qc = useQueryClient();
  return () => {
    if (leadId) {
      void qc.invalidateQueries({ queryKey: apptKeys.lead(leadId) });
      void qc.invalidateQueries({ queryKey: apptKeys.slots(leadId) });
    }
    void qc.invalidateQueries({ queryKey: ["appointments", "list"] });
    void qc.invalidateQueries({ queryKey: ["appointments", "funnel"] });
  };
}

export function useBook(leadId: string) {
  const done = useInvalidate(leadId);
  return useMutation({
    mutationFn: (body: { starts_at: string; notes?: string; language?: string }) =>
      unwrap(api.POST("/v1/leads/{leadId}/appointments", { params: { path: { leadId } }, body })),
    meta: { silent: true },
    onSuccess: (a) => {
      track("appointment.booked", { source: "agent", risk: a.risk_score });
      done();
    },
  });
}

export function useBookingLink(leadId: string) {
  return useMutation({
    mutationFn: () => unwrap(api.POST("/v1/leads/{leadId}/booking-link", { params: { path: { leadId } } })),
    onSuccess: () => track("appointment.link"),
  });
}

export function useReschedule(leadId?: string) {
  const done = useInvalidate(leadId);
  return useMutation({
    mutationFn: ({ id, starts_at }: { id: string; starts_at: string }) =>
      unwrap(
        api.POST("/v1/appointments/{appointmentId}/reschedule", {
          params: { path: { appointmentId: id } },
          body: { starts_at },
        }),
      ),
    meta: { silent: true },
    onSuccess: done,
  });
}

export function useCancelAppointment(leadId?: string) {
  const done = useInvalidate(leadId);
  return useMutation({
    mutationFn: (id: string) =>
      unwrap(api.POST("/v1/appointments/{appointmentId}/cancel", { params: { path: { appointmentId: id } } })),
    onSuccess: done,
  });
}

export function useOutcome(leadId?: string) {
  const done = useInvalidate(leadId);
  return useMutation({
    mutationFn: ({ id, outcome }: { id: string; outcome: "attended" | "no_show" }) =>
      unwrap(
        api.POST("/v1/appointments/{appointmentId}/outcome", {
          params: { path: { appointmentId: id } },
          body: { outcome },
        }),
      ),
    onSuccess: (a) => {
      track("appointment.outcome", { outcome: a.status });
      done();
    },
  });
}

export function useAppointments(q: ListQuery) {
  return useQuery({
    queryKey: apptKeys.list(q),
    queryFn: () => unwrap(api.GET("/v1/appointments", { params: { query: q } })),
  });
}

export function useFunnel(q: FunnelQuery) {
  return useQuery({
    queryKey: apptKeys.funnel(q),
    queryFn: () => unwrap(api.GET("/v1/appointments/funnel", { params: { query: q } })),
  });
}

export function useMyCalendar() {
  return useQuery({ queryKey: apptKeys.calendar, queryFn: () => unwrap(api.GET("/v1/me/calendar")) });
}

export function useConnectCalendar() {
  return useMutation({
    mutationFn: (provider: "google" | "microsoft") =>
      unwrap(api.POST("/v1/me/calendar/connect", { body: { provider } })),
    meta: { silent: true },
    onSuccess: ({ authorize_url }) => window.location.assign(authorize_url),
  });
}

export function useDisconnectCalendar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => unwrapEmpty(api.DELETE("/v1/me/calendar")),
    onSuccess: () => void qc.invalidateQueries({ queryKey: apptKeys.calendar }),
  });
}
