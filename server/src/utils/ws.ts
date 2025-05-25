import { RawData } from "ws";
import { log } from "./logger";

const ACTOR = "utils/ws";

export function asString(message: RawData) {
  if (message instanceof Buffer) {
    return message.toString();
  } else if (typeof message === "string") {
    return message;
  } else {
    log(ACTOR, "Error: Received message is not a string");
    return null;
  }
}
