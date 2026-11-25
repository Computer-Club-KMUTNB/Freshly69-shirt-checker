import { describe, expect, it } from "vitest";
import { backCameras } from "./cameras";

const cam = (label: string) => ({ kind: "videoinput", label, deviceId: label, groupId: "", toJSON: () => ({}) }) as MediaDeviceInfo;

describe("backCameras (lens switch = rear lenses only)", () => {
  it("iPhone labels", () => {
    const r = backCameras([cam("Front Camera"), cam("Back Camera"), cam("Back Ultra Wide Camera"), cam("Back Telephoto Camera")]);
    expect(r.map((d) => d.label)).toEqual(["Back Camera", "Back Ultra Wide Camera", "Back Telephoto Camera"]);
  });
  it("Android labels", () => {
    const r = backCameras([cam("camera2 1, facing front"), cam("camera2 0, facing back"), cam("camera2 2, facing back")]);
    expect(r).toHaveLength(2);
  });
  it("unknown labels: drop anything that says front", () => {
    expect(backCameras([cam("Integrated Webcam"), cam("FaceTime HD Camera")]).map((d) => d.label)).toEqual(["Integrated Webcam"]);
  });
});
