class Kv < Formula
  desc "Secure API key storage via macOS Keychain"
  homepage "https://github.com/dxiongya/kv-cli"
  url "https://github.com/dxiongya/kv-cli/archive/refs/tags/v1.1.0.tar.gz"
  sha256 "10080d0f833c49f0981245773f2d39f54e5d7de06cb7bae561aa3a5cf6c676b8"
  license "MIT"

  def install
    bin.install "bin/kv"
  end

  test do
    assert_match "kv v#{version}", shell_output("#{bin}/kv version")
  end
end
