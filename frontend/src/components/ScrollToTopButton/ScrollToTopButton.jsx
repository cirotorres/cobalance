import { useEffect, useState } from "react";
import { ChevronUp } from "lucide-react";
import "./ScrollToTopButton.css";

export default function ScrollToTopButton() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setShow(window.scrollY > 400);
    };

    window.addEventListener("scroll", handleScroll);

    return () =>
      window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <button
      className={`scroll-top-button ${ show ? "visible" : "" }`}
      onClick={() =>
        window.scrollTo({
          top: 0,
          behavior: "smooth",
        })
      }
    >
      <ChevronUp size={25} />
    </button>
  );
}