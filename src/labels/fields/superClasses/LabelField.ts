import Printable from "@/labels/Printable";

export default abstract class LabelField extends Printable {
    textContent(): string {
        return ""
    }
}