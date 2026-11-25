import { describe, expect, it } from "vitest";
import { backCameras, pickMainCamera } from "./cameras";

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

describe("pickMainCamera (default lens when the camera opens)", () => {
  const labels = (xs: string[]) => xs.map(cam);
  it("iPhone Pro: virtual triple camera (auto macro)", () => {
    const b = labels(["Back Camera", "Back Ultra Wide Camera", "Back Telephoto Camera", "Back Dual Wide Camera", "Back Triple Camera"]);
    expect(b[pickMainCamera(b)].label).toBe("Back Triple Camera");
  });
  it("iPhone without virtual cameras: main lens, not ultra wide", () => {
    const b = labels(["Back Ultra Wide Camera", "Back Camera"]);
    expect(b[pickMainCamera(b)].label).toBe("Back Camera");
  });
  it("Android: lowest camera2 index", () => {
    const b = labels(["camera2 2, facing back", "camera2 0, facing back", "camera2 3, facing back"]);
    expect(b[pickMainCamera(b)].label).toBe("camera2 0, facing back");
  });
  it("saved lens wins when it still exists", () => {
    const b = labels(["Back Camera", "Back Telephoto Camera"]);
    expect(pickMainCamera(b, "Back Telephoto Camera")).toBe(1);
    expect(pickMainCamera(b, "gone")).toBe(0);
  });
  it("empty list", () => expect(pickMainCamera([])).toBe(-1));
});
