"use client";

import { Card, CardContent } from "@/components/ui/card";
import { useInterviewers } from "@/contexts/interviewers.context";
import axios from "axios";
import { Loader2, Plus } from "lucide-react";
import { useState } from "react";

function CreateInterviewerButton() {
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const { setInterviewers } = useInterviewers();

  const createInterviewers = async () => {
    if (isLoading) return;

    setIsLoading(true);
    setErrorMessage("");

    try {
      const response = await axios.get("/api/create-interviewer", {
        timeout: 60000,
      });

      const { newInterviewer, newSecondInterviewer } = response.data;

      if (!newInterviewer || !newSecondInterviewer) {
        throw new Error("The API did not return both interviewers.");
      }

      // Update the shared Context immediately.
      setInterviewers([newInterviewer, newSecondInterviewer]);

      alert("Lisa and Bob have been created successfully!");
    } catch (error) {
      console.error("Create interviewers error:", error);

      if (axios.isAxiosError(error)) {
        setErrorMessage(
          error.response?.data?.details ||
          error.response?.data?.error ||
          error.message
        );
      } else {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "An unexpected error occurred."
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      <Card
        className="p-0 inline-block cursor-pointer hover:scale-105 ease-in-out duration-300 h-40 w-36 ml-1 mr-3 rounded-xl shrink-0 overflow-hidden shadow-md"
        onClick={createInterviewers}
      >
        <CardContent className="p-0">
          {isLoading ? (
            <div className="w-full h-20 flex justify-center items-center">
              <Loader2 size={40} className="animate-spin" />
            </div>
          ) : (
            <div className="w-full h-20 flex justify-center items-center">
              <Plus size={40} />
            </div>
          )}

          <p className="my-3 mx-auto text-xs text-wrap w-fit text-center">
            {isLoading ? "Creating..." : "Create two Default Interviewers"}
          </p>
        </CardContent>
      </Card>

      {errorMessage && (
        <p className="text-red-500 text-xs mt-2 max-w-36 break-words">
          {errorMessage}
        </p>
      )}
    </div>
  );
}

export default CreateInterviewerButton;
