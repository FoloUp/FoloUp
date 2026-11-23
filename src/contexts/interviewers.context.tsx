
"use client";

import type { Interviewer } from "@/types/interviewer";
import { useClerk } from "@clerk/nextjs";
import axios from "axios";
import React, {
  useState,
  useContext,
  type ReactNode,
  useEffect,
} from "react";

interface InterviewerContextProps {
  interviewers: Interviewer[];
  setInterviewers: React.Dispatch<React.SetStateAction<Interviewer[]>>;
  createInterviewer: (payload: any) => void;
  interviewersLoading: boolean;
  setInterviewersLoading: (value: boolean) => void;
}

export const InterviewerContext =
  React.createContext<InterviewerContextProps>({
    interviewers: [],
    setInterviewers: () => {},
    createInterviewer: () => {},
    interviewersLoading: false,
    setInterviewersLoading: () => undefined,
  });

interface InterviewerProviderProps {
  children: ReactNode;
}

export function InterviewerProvider({
  children,
}: InterviewerProviderProps) {
  const [interviewers, setInterviewers] = useState<Interviewer[]>([]);
  const [interviewersLoading, setInterviewersLoading] = useState(true);

  const { user } = useClerk();

  const fetchInterviewers = async () => {
    try {
      setInterviewersLoading(true);

      const response = await axios.get("/api/interviewers");

      setInterviewers(response.data.interviewers ?? []);
    } catch (error) {
      console.error("Failed to fetch interviewers:", error);
      setInterviewers([]);
    } finally {
      setInterviewersLoading(false);
    }
  };

  const createInterviewer = async (payload: any) => {
    try {
      await axios.post("/api/interviewers", payload);
      await fetchInterviewers();
    } catch (error) {
      console.error("Failed to create interviewer:", error);
      throw error;
    }
  };

  useEffect(() => {
    if (user?.id) {
      fetchInterviewers();
    } else {
      setInterviewers([]);
      setInterviewersLoading(false);
    }
  }, [user?.id]);

  return (
    <InterviewerContext.Provider
      value={{
        interviewers,
        setInterviewers,
        createInterviewer,
        interviewersLoading,
        setInterviewersLoading,
      }}
    >
      {children}
    </InterviewerContext.Provider>
  );
}

export const useInterviewers = () => {
  return useContext(InterviewerContext);
};
