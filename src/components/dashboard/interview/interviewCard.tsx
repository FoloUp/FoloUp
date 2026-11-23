
import MiniLoader from "@/components/loaders/mini-loader/miniLoader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { InterviewerService } from "@/services/interviewers.service";
import { ResponseService } from "@/services/responses.service";
import axios from "axios";
import {
  ArrowUpRight,
  Copy,
  CopyCheck,
  UserRound,
} from "lucide-react";
import Image from "next/image";
import { useEffect, useState } from "react";
import { toast } from "sonner";

interface Props {
  name: string | null;
  interviewerId: bigint | number | string | null;
  id: string;
  url: string;
  readableSlug: string | null;
}

const baseUrl = process.env.NEXT_PUBLIC_LIVE_URL;

function InterviewCard({
  name,
  interviewerId,
  id,
  url,
  readableSlug,
}: Props) {
  const [copied, setCopied] = useState(false);
  const [responseCount, setResponseCount] = useState<number | null>(null);
  const [isFetching, setIsFetching] = useState(false);
  const [img, setImg] = useState<string | null>(null);

  // Fetch interviewer safely
  useEffect(() => {
    let cancelled = false;

    const fetchInterviewer = async () => {
      try {
        const interviewer =
          await InterviewerService.getInterviewer(interviewerId);

        if (!cancelled) {
          setImg(
            typeof interviewer?.image === "string" &&
              interviewer.image.trim()
              ? interviewer.image
              : null
          );
        }
      } catch (error) {
        console.error("[InterviewCard] Failed to fetch interviewer:", error);

        if (!cancelled) {
          setImg(null);
        }
      }
    };

    fetchInterviewer();

    return () => {
      cancelled = true;
    };
  }, [interviewerId]);

  // Fetch and analyze responses
  useEffect(() => {
    let cancelled = false;

    const fetchResponses = async () => {
      try {
        const responses = await ResponseService.getAllResponses(id);

        if (cancelled) return;

        setResponseCount(responses.length);

        const pendingResponses = responses.filter(
          (response) => !response.is_analysed
        );

        if (pendingResponses.length > 0) {
          setIsFetching(true);

          for (const response of pendingResponses) {
            if (cancelled) break;

            try {
              const result = await axios.post("/api/get-call", {
                id: response.call_id,
              });

              if (result.status !== 200) {
                throw new Error(
                  `HTTP error! status: ${result.status}`
                );
              }
            } catch (error) {
              console.error(
                `[InterviewCard] Failed to analyze response ${response.call_id}:`,
                error
              );
            }
          }
        }
      } catch (error) {
        console.error("[InterviewCard] Failed to fetch responses:", error);
      } finally {
        if (!cancelled) {
          setIsFetching(false);
        }
      }
    };

    fetchResponses();

    return () => {
      cancelled = true;
    };
  }, [id]);

  const copyToClipboard = async () => {
    const interviewLink = readableSlug
      ? `${baseUrl}/call/${readableSlug}`
      : url;

    try {
      await navigator.clipboard.writeText(interviewLink);

      setCopied(true);

      toast.success(
        "The link to your interview has been copied to your clipboard.",
        {
          position: "bottom-right",
          duration: 3000,
        }
      );

      setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch (error) {
      console.error("[InterviewCard] Failed to copy link:", error);

      toast.error("Failed to copy the interview link.");
    }
  };

  const handleJumpToInterview = (
    event: React.MouseEvent<HTMLButtonElement>
  ) => {
    event.stopPropagation();
    event.preventDefault();

    const interviewPath = readableSlug
      ? `/call/${readableSlug}`
      : `/call/${url}`;

    window.open(interviewPath, "_blank", "noopener,noreferrer");
  };

  return (
    <a
      href={`/interviews/${id}`}
      style={{
        pointerEvents: isFetching ? "none" : "auto",
        cursor: isFetching ? "default" : "pointer",
      }}
    >
      <Card className="relative p-0 mt-4 inline-block cursor-pointer h-60 w-56 ml-1 mr-3 rounded-xl shrink-0 overflow-hidden shadow-md">
        <CardContent className={`p-0 ${isFetching ? "opacity-60" : ""}`}>
          <div className="w-full h-40 overflow-hidden bg-indigo-600 flex items-center text-center">
            <CardTitle className="w-full mt-3 mx-2 text-white text-lg">
              {name}

              {isFetching && (
                <div className="z-100 mt-[-5px]">
                  <MiniLoader />
                </div>
              )}
            </CardTitle>
          </div>

          <div className="flex flex-row items-center mx-4">
            <div className="w-full overflow-hidden">
              {img ? (
                <Image
                  src={img}
                  alt="Picture of the interviewer"
                  width={70}
                  height={70}
                  className="object-cover object-center"
                  onError={() => setImg(null)}
                />
              ) : (
                <div className="w-[70px] h-[70px] flex items-center justify-center rounded-full bg-gray-100 text-gray-500">
                  <UserRound size={32} />
                </div>
              )}
            </div>

            <div className="text-black text-sm font-semibold mt-2 mr-2 whitespace-nowrap">
              Responses:{" "}
              <span className="font-normal">
                {responseCount ?? 0}
              </span>
            </div>
          </div>

          <div className="absolute top-2 right-2 flex gap-1">
            <Button
              className="text-xs text-indigo-600 px-1 h-6"
              variant="secondary"
              onClick={handleJumpToInterview}
            >
              <ArrowUpRight size={16} />
            </Button>

            <Button
              className={`text-xs text-indigo-600 px-1 h-6 ${
                copied ? "bg-indigo-300 text-white" : ""
              }`}
              variant="secondary"
              onClick={(event) => {
                event.stopPropagation();
                event.preventDefault();
                copyToClipboard();
              }}
            >
              {copied ? (
                <CopyCheck size={16} />
              ) : (
                <Copy size={16} />
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </a>
  );
}

export default InterviewCard;
